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
import {
  DEMO_DIAGNOSIS,
  DEMO_PROBE,
  DEMO_REPAIR,
} from "@/lib/fixtures/demo-fallback";

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

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
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
  const start = screen.getByRole("button", { name: /start sample lesson/i });
  await waitFor(() => expect(start).toBeEnabled());
  expect(screen.getByText(/progress saved in this browser/i)).toBeVisible();
  expect(screen.queryByText(/private to this browser/i)).not.toBeInTheDocument();
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
  expect(
    screen.getByText(/sent for ai analysis.*not stored in a server database/i),
  ).toBeVisible();
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

  const confirmation = screen.getByRole("group", {
    name: /replace your current lesson/i,
  });
  expect(confirmation).toBeVisible();
  expect(screen.getByRole("button", { name: /keep current lesson/i })).toHaveFocus();
  expect(fetchMock).toHaveBeenCalledTimes(1);

  await user.keyboard("{Escape}");
  expect(confirmation).not.toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: /start sample lesson/i }),
  ).toHaveFocus();

  await user.click(screen.getByRole("button", { name: /start sample lesson/i }));

  await user.click(
    screen.getByRole("button", { name: /replace current lesson/i }),
  );
  expect(
    await screen.findByRole("heading", { name: nextChallenge.prompt }),
  ).toBeInTheDocument();
  expect(screen.getByLabelText(/your explanation/i)).toHaveValue("");
});

it("continues a backed-out lesson with the exact prompt and answer without fetching", async () => {
  const fetchMock = vi.fn().mockResolvedValue(challengeResponse());
  vi.stubGlobal("fetch", fetchMock);
  const user = userEvent.setup();

  render(<RecallApp />);
  await user.click(
    await screen.findByRole("button", { name: /start sample lesson/i }),
  );
  await user.type(await screen.findByLabelText(/your explanation/i), LONG_EXPLANATION);
  await user.click(screen.getByRole("button", { name: /^back$/i }));

  await user.click(
    screen.getByRole("button", { name: /continue current lesson/i }),
  );

  expect(screen.getByRole("heading", { name: CHALLENGE.prompt })).toBeVisible();
  expect(screen.getByLabelText(/your explanation/i)).toHaveValue(LONG_EXPLANATION);
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

const ADVANCED_SESSIONS = [
  ["diagnosis", { diagnosis: DEMO_DIAGNOSIS, probe: DEMO_PROBE }],
  ["repair", { diagnosis: DEMO_DIAGNOSIS, probe: DEMO_PROBE }],
  [
    "result",
    { diagnosis: DEMO_DIAGNOSIS, probe: DEMO_PROBE, repair: DEMO_REPAIR },
  ],
] as const;

it.each(ADVANCED_SESSIONS)(
  "restored %s stage can return to the preserved teachback",
  async (stage, data) => {
    localStorage.setItem(
      "recall.session.v1",
      JSON.stringify(createRestoredSession({ stage, ...data })),
    );
    vi.stubGlobal("fetch", vi.fn());
    const user = userEvent.setup();

    render(<RecallApp />);
    await user.click(
      await screen.findByRole("button", { name: /back to my explanation/i }),
    );

    expect(screen.getByRole("heading", { name: CHALLENGE.prompt })).toBeVisible();
    expect(screen.getByLabelText(/your explanation/i)).toHaveValue(
      LONG_EXPLANATION,
    );
  },
);

it.each(ADVANCED_SESSIONS)(
  "restored %s stage can start over without a blank trap",
  async (stage, data) => {
    localStorage.setItem(
      "recall.session.v1",
      JSON.stringify(createRestoredSession({ stage, ...data })),
    );
    vi.stubGlobal("fetch", vi.fn());
    const user = userEvent.setup();

    render(<RecallApp />);
    await user.click(
      await screen.findByRole("button", { name: /start over/i }),
    );

    expect(
      screen.getByRole("button", { name: /start sample lesson/i }),
    ).toBeEnabled();
    expect(
      screen.queryByText(/your reasoning map is ready/i),
    ).not.toBeInTheDocument();
  },
);

it("ignores corrupt or outdated persisted sessions", async () => {
  localStorage.setItem(
    "recall.session.v1",
    JSON.stringify({ version: 0, stage: "teachback" }),
  );
  vi.stubGlobal("fetch", vi.fn());

  render(<RecallApp />);

  const start = screen.getByRole("button", { name: /start sample lesson/i });
  await waitFor(() => expect(start).toBeEnabled());
  await waitFor(() => {
    const stored = JSON.parse(
      localStorage.getItem("recall.session.v1") ?? "{}",
    ) as Partial<LearningSession>;
    expect(stored.version).toBe(1);
    expect(stored.stage).toBe("start");
    expect(stored.id).toMatch(/^[0-9a-f-]{36}$/i);
  });
});

it("ignores a late challenge resolution after unmount", async () => {
  const pending = deferred<Response>();
  vi.stubGlobal("fetch", vi.fn().mockReturnValue(pending.promise));
  const user = userEvent.setup();
  const view = render(<RecallApp />);
  const start = screen.getByRole("button", { name: /start sample lesson/i });
  await waitFor(() => expect(start).toBeEnabled());
  await user.click(start);
  await waitFor(() =>
    expect(
      JSON.parse(localStorage.getItem("recall.session.v1") ?? "{}"),
    ).toMatchObject({ stage: "start", challenge: null }),
  );

  view.unmount();
  pending.resolve(challengeResponse());
  await Promise.resolve();
  await Promise.resolve();

  expect(
    JSON.parse(localStorage.getItem("recall.session.v1") ?? "{}"),
  ).toMatchObject({ stage: "start", challenge: null });
});

it("ignores a late diagnosis resolution after unmount", async () => {
  const pending = deferred<Response>();
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(challengeResponse())
    .mockReturnValueOnce(pending.promise);
  vi.stubGlobal("fetch", fetchMock);
  const user = userEvent.setup();
  const view = render(<RecallApp />);
  await user.click(
    await screen.findByRole("button", { name: /start sample lesson/i }),
  );
  await user.type(await screen.findByLabelText(/your explanation/i), LONG_EXPLANATION);
  await user.click(screen.getByRole("button", { name: /reveal my blind spot/i }));
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  view.unmount();

  pending.resolve(
    jsonResponse({
      ok: true,
      data: { diagnosis: DEMO_DIAGNOSIS, probe: DEMO_PROBE },
      fallback: false,
    }),
  );
  await Promise.resolve();
  await Promise.resolve();

  expect(
    JSON.parse(localStorage.getItem("recall.session.v1") ?? "{}"),
  ).toMatchObject({ stage: "teachback", diagnosis: null, probe: null });
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
