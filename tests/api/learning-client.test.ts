import { readFileSync } from "node:fs";
import {
  LearningApiError,
  requestChallenge,
  requestDiagnosis,
  requestRepair,
} from "@/lib/api/learning-client";
import {
  DEMO_CHALLENGE,
  DEMO_DIAGNOSIS,
  DEMO_PROBE,
  DEMO_REPAIR,
} from "@/lib/fixtures/demo-fallback";
import {
  DEMO_FIRST_EXPLANATION,
  DEMO_REVISED_EXPLANATION,
  SAMPLE_LESSON,
} from "@/lib/domain/sample-lesson";

const SESSION_ID = "01234567-89ab-4def-8123-456789abcdef";

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("runtime-validates challenge data inside the stable success envelope", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      jsonResponse({
        ok: true,
        data: { ...DEMO_CHALLENGE, prompt: "invalid" },
        fallback: false,
      }),
    ),
  );

  const error = await requestChallenge(SESSION_ID, SAMPLE_LESSON).catch(
    (caught: unknown) => caught,
  );

  expect(error).toBeInstanceOf(LearningApiError);
  expect(error).toMatchObject({
    code: "INVALID_RESPONSE",
    message: "RecallMap could not validate the learning service response.",
  });
  expect(error).not.toHaveProperty("cause");
  expect(JSON.stringify(error)).not.toContain("invalid");
});

it("maps server failures to a stable code and generic local message", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      jsonResponse(
        {
          ok: false,
          error: {
            code: "MODEL_UNAVAILABLE",
            message: "sensitive server detail",
          },
        },
        503,
      ),
    ),
  );

  const error = await requestChallenge(SESSION_ID, SAMPLE_LESSON).catch(
    (caught: unknown) => caught,
  );

  expect(error).toMatchObject({
    code: "MODEL_UNAVAILABLE",
    message: "RecallMap is temporarily unavailable. Please try again.",
  });
  expect(JSON.stringify(error)).not.toContain("sensitive server detail");
});

it("keeps the unexpected client fallback branded as RecallMap", () => {
  const learningSession = readFileSync(
    "src/hooks/use-learning-session.ts",
    "utf8",
  );

  expect(learningSession).toContain(
    "RecallMap encountered an unexpected error. Please try again.",
  );
  expect(learningSession).not.toContain(
    "Recall encountered an unexpected error. Please try again.",
  );
});

it.each([
  ["INVALID_INPUT", 400, "RecallMap could not accept that learning input."],
  ["MODEL_REFUSED", 422, "RecallMap cannot analyze this material."],
  [
    "MODEL_UNAVAILABLE",
    503,
    "RecallMap is temporarily unavailable. Please try again.",
  ],
  [
    "INTERNAL_ERROR",
    500,
    "RecallMap encountered an unexpected error. Please try again.",
  ],
])(
  "uses RecallMap copy for the %s server failure",
  async (code, status, message) => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(
          { ok: false, error: { code, message: "sensitive server detail" } },
          status,
        ),
      ),
    );

    await expect(requestChallenge(SESSION_ID, SAMPLE_LESSON)).rejects.toMatchObject({
      code,
      message,
    });
  },
);

it("uses RecallMap copy for malformed response and network failures", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response("not-json", { status: 200 })),
  );

  await expect(requestChallenge(SESSION_ID, SAMPLE_LESSON)).rejects.toMatchObject({
    code: "INVALID_RESPONSE",
    message: "RecallMap could not validate the learning service response.",
  });

  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

  await expect(requestChallenge(SESSION_ID, SAMPLE_LESSON)).rejects.toMatchObject({
    code: "NETWORK_ERROR",
    message: "RecallMap could not reach the learning service. Please try again.",
  });
});

it("classifies malformed JSON as an invalid response rather than a network error", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response("not-json", {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    ),
  );

  const error = await requestChallenge(SESSION_ID, SAMPLE_LESSON).catch(
    (caught: unknown) => caught,
  );

  expect(error).toMatchObject({
    code: "INVALID_RESPONSE",
    message: "RecallMap could not validate the learning service response.",
  });
});

it("runtime-validates combined diagnosis and probe success data", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      jsonResponse({
        ok: true,
        data: {
          diagnosis: { ...DEMO_DIAGNOSIS, nodes: [] },
          probe: DEMO_PROBE,
        },
        fallback: false,
      }),
    ),
  );

  await expect(
    requestDiagnosis(
      SESSION_ID,
      SAMPLE_LESSON,
      DEMO_CHALLENGE,
      DEMO_FIRST_EXPLANATION,
    ),
  ).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
});

it("runtime-validates repair-result success data", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      jsonResponse({
        ok: true,
        data: { ...DEMO_REPAIR, overallStatus: "invented" },
        fallback: false,
      }),
    ),
  );

  await expect(
    requestRepair(
      SESSION_ID,
      SAMPLE_LESSON,
      DEMO_CHALLENGE,
      DEMO_FIRST_EXPLANATION,
      DEMO_DIAGNOSIS,
      DEMO_PROBE,
      DEMO_REVISED_EXPLANATION,
    ),
  ).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
});

it("keeps challenge in requestRepair's signature but omits it from the strict verify body", async () => {
  const fetchMock = vi.fn().mockResolvedValue(
    jsonResponse({ ok: true, data: DEMO_REPAIR, fallback: false }),
  );
  vi.stubGlobal("fetch", fetchMock);

  await requestRepair(
    SESSION_ID,
    SAMPLE_LESSON,
    DEMO_CHALLENGE,
    DEMO_FIRST_EXPLANATION,
    DEMO_DIAGNOSIS,
    DEMO_PROBE,
    DEMO_REVISED_EXPLANATION,
  );

  const body = JSON.parse(
    String((fetchMock.mock.calls[0][1] as RequestInit).body),
  ) as Record<string, unknown>;
  expect(body).not.toHaveProperty("challenge");
  expect(body).toEqual({
    operation: "verify",
    sessionId: SESSION_ID,
    source: SAMPLE_LESSON,
    firstExplanation: DEMO_FIRST_EXPLANATION,
    diagnosis: DEMO_DIAGNOSIS,
    probe: DEMO_PROBE,
    revisedExplanation: DEMO_REVISED_EXPLANATION,
  });
});
