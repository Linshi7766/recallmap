import { StrictMode } from "react";
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Page from "@/app/page";
import { RecallApp } from "@/components/recall/recall-app";
import { Progress } from "@/components/recall/progress";
import { SAMPLE_LESSON } from "@/lib/domain/sample-lesson";
import type { Challenge, LessonSource } from "@/lib/domain/contracts";
import type { LearningSession } from "@/lib/domain/session";

const CHALLENGE: Challenge = {
  lessonTitle: "Correlation vs. Causation",
  concept: "Correlation and causation",
  prompt:
    "Why can't correlation alone prove causation, even when two variables consistently move together?",
  evidencePassages: [
    "Correlation alone does not identify the mechanism that produced an association.",
  ],
};

const LONG_EXPLANATION =
  "Correlation shows that two variables move together, but this pattern alone does not prove that either variable causes the other one.";

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function challengeResponse(challenge: Challenge = CHALLENGE): Response {
  return jsonResponse({ ok: true, data: challenge, fallback: false });
}

function createRestoredSession(
  overrides: Partial<LearningSession> = {},
): LearningSession {
  return {
    version: 1,
    id: "01234567-89ab-4def-8123-456789abcdef",
    stage: "teachback",
    source: SAMPLE_LESSON,
    challenge: CHALLENGE,
    firstExplanation: LONG_EXPLANATION,
    diagnosis: null,
    probe: null,
    revisedExplanation: "",
    repair: null,
    ...overrides,
  };
}

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("introduces Recall as a guided misconception detector", async () => {
  vi.stubGlobal("fetch", vi.fn());
  render(<Page />);

  expect(
    screen.getByRole("heading", {
      name: /can you explain what you think you know/i,
    }),
  ).toBeInTheDocument();
  expect(
    await screen.findByRole("button", { name: /start sample lesson/i }),
  ).toBeEnabled();
  expect(screen.queryByRole("log")).not.toBeInTheDocument();
});

it("starts the sample lesson and shows the exact generated prompt", async () => {
  const fetchMock = vi.fn().mockResolvedValue(challengeResponse());
  vi.stubGlobal("fetch", fetchMock);
  const user = userEvent.setup();

  render(<RecallApp />);
  await user.click(
    screen.getByRole("button", { name: /start sample lesson/i }),
  );

  expect(
    await screen.findByRole("heading", { name: CHALLENGE.prompt }),
  ).toBeInTheDocument();
  expect(screen.getByLabelText(/your explanation/i)).toHaveValue("");
  expect(fetchMock).toHaveBeenCalledWith(
    "/api/learn",
    expect.objectContaining({ method: "POST" }),
  );
});

it("normalizes valid pasted material and starts its challenge", async () => {
  const fetchMock = vi.fn().mockResolvedValue(challengeResponse());
  vi.stubGlobal("fetch", fetchMock);
  const user = userEvent.setup();
  const pastedText = `  ${"A causal explanation needs evidence. ".repeat(9)}\n\n  `;

  render(<RecallApp />);
  await user.click(screen.getByText(/paste your own material/i));
  await user.type(screen.getByLabelText(/lesson title/i), "  My   notes  ");
  fireEvent.change(screen.getByLabelText(/study material/i), {
    target: { value: pastedText },
  });
  await user.click(screen.getByRole("button", { name: /use this material/i }));

  await screen.findByRole("heading", { name: CHALLENGE.prompt });
  const body = JSON.parse(
    String((fetchMock.mock.calls[0][1] as RequestInit).body),
  ) as { source: LessonSource };
  expect(body.source).toMatchObject({
    kind: "pasted",
    title: "My notes",
    text: "A causal explanation needs evidence. ".repeat(9).trim(),
  });
});

it("shows inline errors for invalid pasted material without requesting a challenge", async () => {
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  const user = userEvent.setup();

  render(<RecallApp />);
  await user.click(screen.getByText(/paste your own material/i));
  await user.type(screen.getByLabelText(/lesson title/i), "A title");
  await user.type(screen.getByLabelText(/study material/i), "Too short");
  await user.click(screen.getByRole("button", { name: /use this material/i }));

  expect(screen.getByText(/at least 240 characters/i)).toBeInTheDocument();
  expect(fetchMock).not.toHaveBeenCalled();
});

it("preserves an 80+ character explanation when diagnosis fails and retries it", async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(challengeResponse())
    .mockResolvedValueOnce(
      jsonResponse(
        {
          ok: false,
          error: {
            code: "MODEL_UNAVAILABLE",
            message: "Learning service is temporarily unavailable.",
          },
        },
        503,
      ),
    )
    .mockImplementationOnce(() => new Promise(() => {}));
  vi.stubGlobal("fetch", fetchMock);
  const user = userEvent.setup();

  render(<RecallApp />);
  await user.click(
    screen.getByRole("button", { name: /start sample lesson/i }),
  );
  const answer = await screen.findByLabelText(/your explanation/i);
  await user.type(answer, LONG_EXPLANATION);
  await user.click(screen.getByRole("button", { name: /reveal my blind spot/i }));

  expect(
    await screen.findByRole("button", { name: /retry analysis/i }),
  ).toBeEnabled();
  expect(answer).toHaveValue(LONG_EXPLANATION);

  await user.click(screen.getByRole("button", { name: /retry analysis/i }));
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
  const retryBody = JSON.parse(
    String((fetchMock.mock.calls[2][1] as RequestInit).body),
  ) as { firstExplanation: string };
  expect(retryBody.firstExplanation).toBe(LONG_EXPLANATION);
  expect(answer).toHaveValue(LONG_EXPLANATION);
  expect(
    JSON.parse(localStorage.getItem("recall.session.v1") ?? "{}"),
  ).toMatchObject({ firstExplanation: LONG_EXPLANATION, stage: "teachback" });
});

it("rejects a structurally invalid success response with a generic error", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      challengeResponse({ ...CHALLENGE, prompt: "Too short" }),
    ),
  );
  const user = userEvent.setup();

  render(<RecallApp />);
  await user.click(
    screen.getByRole("button", { name: /start sample lesson/i }),
  );

  expect(await screen.findByRole("alert")).toHaveTextContent(
    /could not validate the learning service response/i,
  );
  expect(
    screen.getByRole("button", { name: /start sample lesson/i }),
  ).toBeEnabled();
});

it("restores after mount without first overwriting the stored session in Strict Mode", async () => {
  const restored = createRestoredSession();
  localStorage.setItem("recall.session.v1", JSON.stringify(restored));
  const setItem = vi.spyOn(Storage.prototype, "setItem");
  vi.stubGlobal("fetch", vi.fn());

  render(
    <StrictMode>
      <RecallApp />
    </StrictMode>,
  );

  expect(
    screen.getByRole("button", { name: /start sample lesson/i }),
  ).toBeDisabled();

  expect(
    await screen.findByRole("heading", { name: CHALLENGE.prompt }),
  ).toBeInTheDocument();
  expect(screen.getByLabelText(/your explanation/i)).toHaveValue(
    LONG_EXPLANATION,
  );
  await waitFor(() => expect(setItem).toHaveBeenCalled());
  for (const call of setItem.mock.calls) {
    const persisted = JSON.parse(call[1]) as LearningSession;
    expect(persisted.id).toBe(restored.id);
  }
});

it("confirms lesson replacement and clears the previous explanation", async () => {
  const nextChallenge = {
    ...CHALLENGE,
    concept: "A fresh concept",
    prompt:
      "Explain how a fresh causal question should be evaluated using the supplied evidence.",
  };
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(challengeResponse())
    .mockResolvedValueOnce(challengeResponse(nextChallenge));
  vi.stubGlobal("fetch", fetchMock);
  const user = userEvent.setup();

  render(<RecallApp />);
  await user.click(
    await screen.findByRole("button", { name: /start sample lesson/i }),
  );
  await user.type(await screen.findByLabelText(/your explanation/i), LONG_EXPLANATION);
  await user.click(screen.getByRole("button", { name: /^back$/i }));
  await user.click(screen.getByRole("button", { name: /start sample lesson/i }));

  expect(screen.getByRole("alertdialog")).toHaveTextContent(
    /replace your current lesson/i,
  );
  expect(fetchMock).toHaveBeenCalledTimes(1);

  await user.click(
    screen.getByRole("button", { name: /replace current lesson/i }),
  );
  expect(
    await screen.findByRole("heading", { name: nextChallenge.prompt }),
  ).toBeInTheDocument();
  expect(screen.getByLabelText(/your explanation/i)).toHaveValue("");
});

it("ignores corrupt or outdated persisted sessions", async () => {
  localStorage.setItem(
    "recall.session.v1",
    JSON.stringify({ version: 0, stage: "teachback" }),
  );
  vi.stubGlobal("fetch", vi.fn());

  render(<RecallApp />);

  expect(
    await screen.findByRole("button", { name: /start sample lesson/i }),
  ).toBeEnabled();
  await waitFor(() => {
    const stored = JSON.parse(
      localStorage.getItem("recall.session.v1") ?? "{}",
    ) as Partial<LearningSession>;
    expect(stored.version).toBe(1);
    expect(stored.stage).toBe("start");
    expect(stored.id).toMatch(/^[0-9a-f-]{36}$/i);
  });
});

it("continues when localStorage is unavailable", async () => {
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new DOMException("Storage denied", "SecurityError");
  });
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new DOMException("Storage denied", "SecurityError");
  });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(challengeResponse()));
  const user = userEvent.setup();

  render(<RecallApp />);
  await user.click(
    screen.getByRole("button", { name: /start sample lesson/i }),
  );

  expect(
    await screen.findByRole("heading", { name: CHALLENGE.prompt }),
  ).toBeInTheDocument();
});

it.each([
  ["start", "Choose"],
  ["teachback", "Teach Back"],
  ["diagnosis", "Challenge"],
  ["repair", "Challenge"],
  ["result", "Verify"],
] as const)("maps %s to the visible %s progress step", (stage, current) => {
  render(<Progress stage={stage} />);

  expect(screen.getAllByRole("listitem")).toHaveLength(4);
  expect(screen.getByText(current).closest("li")).toHaveAttribute(
    "aria-current",
    "step",
  );
  expect(screen.getAllByText(/Choose|Teach Back|Challenge|Verify/)).toHaveLength(
    4,
  );
});

it("prevents duplicate challenge requests while busy", async () => {
  const fetchMock = vi.fn().mockImplementation(() => new Promise(() => {}));
  vi.stubGlobal("fetch", fetchMock);

  render(<RecallApp />);
  const start = await screen.findByRole("button", {
    name: /start sample lesson/i,
  });
  await waitFor(() => expect(start).toBeEnabled());
  fireEvent.click(start);
  fireEvent.click(start);

  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(start).toBeDisabled();
});
