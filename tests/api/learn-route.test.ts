import { describe, expect, it, vi } from "vitest";
import {
  type Diagnosis,
} from "@/lib/domain/contracts";
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
import { ModelUnavailableError, StructuredModelError } from "@/lib/ai/errors";
import { createLearnPost, type LearningOperations } from "@/app/api/learn/route";

const SESSION_ID = "0ec20ef1-5c4f-4daa-b8f2-1b3028a05e3a";

function request(body: unknown): Request {
  return new Request("http://localhost/api/learn", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function malformedRequest(): Request {
  return new Request("http://localhost/api/learn", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{not-json",
  });
}

const challengeRequest = () => ({
  operation: "generate_challenge" as const,
  sessionId: SESSION_ID,
  source: SAMPLE_LESSON,
});

const diagnoseRequest = () => ({
  operation: "diagnose" as const,
  sessionId: SESSION_ID,
  source: SAMPLE_LESSON,
  challenge: DEMO_CHALLENGE,
  firstExplanation: DEMO_FIRST_EXPLANATION,
});

const verifyRequest = () => ({
  operation: "verify" as const,
  sessionId: SESSION_ID,
  source: SAMPLE_LESSON,
  firstExplanation: DEMO_FIRST_EXPLANATION,
  diagnosis: DEMO_DIAGNOSIS,
  probe: DEMO_PROBE,
  revisedExplanation: DEMO_REVISED_EXPLANATION,
});

function operations(overrides: Partial<LearningOperations> = {}): LearningOperations {
  return {
    generateChallenge: vi.fn(async () => DEMO_CHALLENGE),
    diagnoseExplanation: vi.fn(async () => DEMO_DIAGNOSIS),
    generateChallengeProbe: vi.fn(async () => DEMO_PROBE),
    verifyRepair: vi.fn(async () => DEMO_REPAIR),
    ...overrides,
  };
}

async function body(response: Response) {
  return response.json();
}

describe("POST /api/learn", () => {
  it("returns INVALID_INPUT for malformed JSON, invalid UUID, invalid schema, and short explanations", async () => {
    const post = createLearnPost(operations());
    const malformed = await post(malformedRequest());
    const invalidId = await post(request({ ...challengeRequest(), sessionId: "not-a-uuid" }));
    const invalidSchema = await post(request({ ...challengeRequest(), extra: true }));
    const tooShort = await post(request({ ...diagnoseRequest(), firstExplanation: "too short" }));

    for (const response of [malformed, invalidId, invalidSchema, tooShort]) {
      expect(response.status).toBe(400);
      await expect(body(response)).resolves.toEqual({
        ok: false,
        error: {
          code: "INVALID_INPUT",
          message: "Request must be valid learning input.",
        },
      });
    }
  });

  it("dispatches generate_challenge through the injected operation", async () => {
    const live = operations();
    const post = createLearnPost(live);

    const response = await post(request(challengeRequest()));

    expect(live.generateChallenge).toHaveBeenCalledWith({
      source: SAMPLE_LESSON,
      sessionId: SESSION_ID,
    });
    expect(await body(response)).toEqual({ ok: true, data: DEMO_CHALLENGE, fallback: false });
  });

  it("runs diagnosis before probe and passes the exact selected priority node", async () => {
    const order: string[] = [];
    const live = operations({
      diagnoseExplanation: vi.fn(async () => {
        order.push("diagnose");
        return DEMO_DIAGNOSIS;
      }),
      generateChallengeProbe: vi.fn(async (input) => {
        order.push("probe");
        expect(input.priorityNode).toBe(DEMO_DIAGNOSIS.nodes[1]);
        return DEMO_PROBE;
      }),
    });
    const post = createLearnPost(live);

    const response = await post(request(diagnoseRequest()));

    expect(order).toEqual(["diagnose", "probe"]);
    expect(await body(response)).toEqual({
      ok: true,
      data: { diagnosis: DEMO_DIAGNOSIS, probe: DEMO_PROBE },
      fallback: false,
    });
  });

  it("passes null to probe when diagnosis is all correct", async () => {
    const allCorrect: Diagnosis = {
      ...DEMO_DIAGNOSIS,
      nodes: DEMO_DIAGNOSIS.nodes.map((node) => ({ ...node, status: "correct" as const })),
      priorityNodeId: null,
    };
    const probe = vi.fn(async (input: Parameters<LearningOperations["generateChallengeProbe"]>[0]) => {
      expect(input.priorityNode).toBeNull();
      return DEMO_PROBE;
    });
    const post = createLearnPost(operations({ diagnoseExplanation: vi.fn(async () => allCorrect), generateChallengeProbe: probe }));

    const response = await post(request(diagnoseRequest()));

    expect(response.status).toBe(200);
    expect(probe).toHaveBeenCalledOnce();
  });

  it("dispatches verify through the injected operation", async () => {
    const live = operations();
    const post = createLearnPost(live);

    const response = await post(request(verifyRequest()));

    expect(live.verifyRepair).toHaveBeenCalledWith({
      source: SAMPLE_LESSON,
      sessionId: SESSION_ID,
      firstExplanation: DEMO_FIRST_EXPLANATION,
      diagnosis: DEMO_DIAGNOSIS,
      probe: DEMO_PROBE,
      revisedExplanation: DEMO_REVISED_EXPLANATION,
    });
    expect(await body(response)).toEqual({ ok: true, data: DEMO_REPAIR, fallback: false });
  });

  it("uses fallback only after a live failure for the exact demo request", async () => {
    const unavailable = vi.fn(async () => {
      throw new ModelUnavailableError();
    });
    const post = createLearnPost(operations({ generateChallenge: unavailable }));

    const response = await post(request(challengeRequest()));

    expect(unavailable).toHaveBeenCalledOnce();
    expect(response.status).toBe(200);
    expect(await body(response)).toEqual({ ok: true, data: DEMO_CHALLENGE, fallback: true });
  });

  it("returns exact diagnose and verify fallback shapes after their live operations fail", async () => {
    const post = createLearnPost(operations({
      diagnoseExplanation: vi.fn(async () => { throw new ModelUnavailableError(); }),
      verifyRepair: vi.fn(async () => { throw new ModelUnavailableError(); }),
    }));

    const diagnosisResponse = await post(request(diagnoseRequest()));
    const verifyResponse = await post(request(verifyRequest()));

    expect(await body(diagnosisResponse)).toEqual({
      ok: true,
      data: { diagnosis: DEMO_DIAGNOSIS, probe: DEMO_PROBE },
      fallback: true,
    });
    expect(await body(verifyResponse)).toEqual({
      ok: true,
      data: DEMO_REPAIR,
      fallback: true,
    });
  });

  it("does not use a fallback for a same-id source whose text was altered", async () => {
    const unavailable = vi.fn(async () => {
      throw new ModelUnavailableError();
    });
    const post = createLearnPost(operations({ generateChallenge: unavailable }));

    const response = await post(request({
      ...challengeRequest(),
      source: { ...SAMPLE_LESSON, text: `${SAMPLE_LESSON.text} Altered.` },
    }));

    expect(unavailable).toHaveBeenCalledOnce();
    expect(response.status).toBe(503);
    expect(await body(response)).toEqual({
      ok: false,
      error: { code: "MODEL_UNAVAILABLE", message: "Learning service is temporarily unavailable." },
    });
  });

  it("requires every built-in source field to match before using fallback", async () => {
    for (const source of [
      { ...SAMPLE_LESSON, id: "different-id" },
      { ...SAMPLE_LESSON, kind: "pasted" as const },
      { ...SAMPLE_LESSON, title: "Different title" },
    ]) {
      const unavailable = vi.fn(async () => { throw new ModelUnavailableError(); });
      const post = createLearnPost(operations({ generateChallenge: unavailable }));

      const response = await post(request({ ...challengeRequest(), source }));

      expect(unavailable).toHaveBeenCalledOnce();
      expect(response.status).toBe(503);
      expect(await body(response)).toEqual({
        ok: false,
        error: { code: "MODEL_UNAVAILABLE", message: "Learning service is temporarily unavailable." },
      });
    }
  });

  it("does not use diagnose or verify fallbacks when prior-stage fixtures are altered", async () => {
    const diagnoseUnavailable = vi.fn(async () => {
      throw new ModelUnavailableError();
    });
    const verifyUnavailable = vi.fn(async () => {
      throw new ModelUnavailableError();
    });
    const post = createLearnPost(operations({
      diagnoseExplanation: diagnoseUnavailable,
      verifyRepair: verifyUnavailable,
    }));

    const diagnosisResponse = await post(request({
      ...diagnoseRequest(),
      challenge: { ...DEMO_CHALLENGE, concept: "Altered concept" },
    }));
    const verifyResponse = await post(request({
      ...verifyRequest(),
      probe: { ...DEMO_PROBE, evaluationTarget: "Altered target" },
    }));
    const alteredDiagnosisResponse = await post(request({
      ...verifyRequest(),
      diagnosis: {
        ...DEMO_DIAGNOSIS,
        nodes: DEMO_DIAGNOSIS.nodes.map((node, index) =>
          index === 0 ? { ...node, claim: "Altered claim" } : node,
        ),
      },
    }));

    expect(diagnoseUnavailable).toHaveBeenCalledOnce();
    expect(verifyUnavailable).toHaveBeenCalledTimes(2);
    expect(diagnosisResponse.status).toBe(503);
    expect(verifyResponse.status).toBe(503);
    expect(alteredDiagnosisResponse.status).toBe(503);
  });

  it("returns stable refusal, unavailable, and unexpected failures without leaking request data", async () => {
    const secret = "student answer OPENAI_API_KEY=secret";
    const post = createLearnPost(operations({
      generateChallenge: vi.fn(async () => { throw new StructuredModelError("MODEL_REFUSED", new Error(secret)); }),
    }));
    const refusal = await post(request(challengeRequest()));
    const unavailablePost = createLearnPost(operations({
      generateChallenge: vi.fn(async () => { throw new ModelUnavailableError(new Error(secret)); }),
    }));
    const unavailable = await unavailablePost(request({ ...challengeRequest(), source: { ...SAMPLE_LESSON, title: "Different lesson" } }));
    const unexpectedPost = createLearnPost(operations({
      generateChallenge: vi.fn(async () => { throw new Error(secret); }),
    }));
    const unexpected = await unexpectedPost(request({ ...challengeRequest(), source: { ...SAMPLE_LESSON, kind: "pasted" } }));

    const [refusalBody, unavailableBody, unexpectedBody] = await Promise.all([
      body(refusal), body(unavailable), body(unexpected),
    ]);
    expect(refusal).toHaveProperty("status", 422);
    expect(unavailable).toHaveProperty("status", 503);
    expect(unexpected).toHaveProperty("status", 500);
    expect(refusalBody).toEqual({ ok: false, error: { code: "MODEL_REFUSED", message: "The model cannot help with this request." } });
    expect(unavailableBody).toEqual({ ok: false, error: { code: "MODEL_UNAVAILABLE", message: "Learning service is temporarily unavailable." } });
    expect(unexpectedBody).toEqual({ ok: false, error: { code: "INTERNAL_ERROR", message: "The learning service encountered an unexpected error." } });
    for (const value of [refusalBody, unavailableBody, unexpectedBody]) {
      expect(JSON.stringify(value)).not.toContain(secret);
      expect(JSON.stringify(value)).not.toContain(SAMPLE_LESSON.text);
    }
  });
});
