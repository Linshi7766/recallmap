import { StrictMode } from "react";
import { readFileSync } from "node:fs";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Page from "@/app/page";
import { RecallApp } from "@/components/recall/recall-app";
import { Progress } from "@/components/recall/progress";
import {
  DEMO_FIRST_EXPLANATION,
  DEMO_REVISED_EXPLANATION,
  SAMPLE_LESSON,
} from "@/lib/domain/sample-lesson";
import type {
  Challenge,
  Diagnosis,
  LessonSource,
  Probe,
  RepairResult,
} from "@/lib/domain/contracts";
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

function diagnosisResponse(
  diagnosis: Diagnosis = DEMO_DIAGNOSIS,
  probe: Probe = DEMO_PROBE,
): Response {
  return jsonResponse({
    ok: true,
    data: { diagnosis, probe },
    fallback: false,
  });
}

function repairResponse(repair: RepairResult = DEMO_REPAIR): Response {
  return jsonResponse({ ok: true, data: repair, fallback: false });
}

const ALL_CORRECT_DIAGNOSIS: Diagnosis = {
  nodes: [
    {
      id: "node-1",
      claim: "Correlation describes how two variables vary together.",
      status: "correct",
      diagnosis: "This accurately defines what correlation measures.",
      evidence: "Correlation measures how two variables vary together.",
      confidence: 0.98,
    },
    {
      id: "node-2",
      claim: "An association can have several explanations.",
      status: "correct",
      diagnosis: "This correctly leaves room for reverse and common causes.",
      evidence:
        "An association may arise because one variable causes the other, because causation runs in the reverse direction, because a third variable affects both, because of selection bias, or because of chance.",
      confidence: 0.93,
    },
    {
      id: "node-3",
      claim: "A causal conclusion requires evidence that rules out alternatives.",
      status: "correct",
      diagnosis: "This states the additional standard for a causal claim.",
      evidence:
        "Establishing causation requires a credible design or additional evidence that rules out alternative explanations.",
      confidence: 0.91,
    },
  ],
  priorityNodeId: null,
};

const TRANSFER_PROBE: Probe = {
  question:
    "Two unrelated products sell more during a holiday week. What evidence would you seek before claiming that one product caused the other to sell?",
  evaluationTarget:
    "Whether the learner transfers the need to rule out alternative explanations.",
};

function repairForStatus(
  overallStatus: RepairResult["overallStatus"],
): RepairResult {
  if (overallStatus === "partial") {
    return {
      ...DEMO_REPAIR,
      overallStatus,
      recallCard: null,
      nodes: DEMO_REPAIR.nodes.map((node, index) =>
        index === 1
          ? {
              ...node,
              claim:
                "Correlation alone is not enough, but the causal standard is still incomplete.",
              status: "incomplete" as const,
              diagnosis:
                "The revision rejects the original causal leap but does not yet state what added evidence is needed.",
            }
          : node,
      ),
    };
  }

  if (overallStatus === "not_repaired") {
    return {
      ...DEMO_REPAIR,
      overallStatus,
      recallCard: null,
      nodes: DEMO_REPAIR.nodes.map((node, index) =>
        index === 1
          ? {
              ...node,
              claim: DEMO_DIAGNOSIS.nodes[1].claim,
              status: "misconception" as const,
              diagnosis: DEMO_DIAGNOSIS.nodes[1].diagnosis,
            }
          : node,
      ),
    };
  }

  return DEMO_REPAIR;
}

function invalidPartialRepair(kind: "unchanged" | "status-only"): RepairResult {
  return {
    ...DEMO_REPAIR,
    nodes: DEMO_DIAGNOSIS.nodes.map((node, index) => ({
      ...node,
      previousStatus: node.status,
      status:
        kind === "status-only" && index === 1
          ? ("incomplete" as const)
          : node.status,
      repairExplanation: "The response records the current reasoning link.",
    })),
    overallStatus: "partial",
    recallCard: null,
  };
}

function transferRepair(
  overallStatus: RepairResult["overallStatus"],
): RepairResult {
  return {
    nodes: ALL_CORRECT_DIAGNOSIS.nodes.map((node, index) => {
      const unresolved =
        overallStatus === "partial" && index === 1
          ? {
              claim:
                overallStatus === "partial"
                  ? "The transfer response identifies alternatives but does not apply the evidence standard."
                  : "The transfer response treats the new association as a causal conclusion.",
              status:
                overallStatus === "partial"
                  ? ("incomplete" as const)
                  : ("misconception" as const),
              diagnosis:
                overallStatus === "partial"
                  ? "The new case is partly analyzed but still misses a required condition."
                  : "The new case repeats an unsupported causal inference.",
            }
          : overallStatus === "not_repaired"
            ? {
                claim: `Transfer reasoning ${index + 1} remains unsupported.`,
                status: "misconception" as const,
                diagnosis: `The transfer response does not support reasoning link ${index + 1}.`,
              }
            : {};

      return {
        ...node,
        ...unresolved,
        previousStatus: node.status,
        repairExplanation:
          "The transfer response records how this reasoning link changed.",
      };
    }),
    overallStatus,
    before: "The first explanation applied the idea to the source example.",
    after: "The revised explanation applies the idea to a new situation.",
    recallCard:
      overallStatus === "repaired"
        ? ALL_CORRECT_DIAGNOSIS.nodes[2].claim
        : null,
  };
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

  const heading = screen.getByRole("heading", {
    name: /can you explain what you think you know/i,
  });
  expect(heading).toBeInTheDocument();
  await waitFor(() => expect(heading).toHaveFocus());
  expect(heading).toHaveClass("stage-heading");
  const globalCss = readFileSync("src/app/globals.css", "utf8");
  expect(globalCss).toMatch(
    /\.stage-heading:focus\s*{\s*outline:\s*none;\s*}/,
  );
  expect(globalCss).toMatch(
    /button:focus-visible,\s*input:focus-visible,\s*textarea:focus-visible,\s*summary:focus-visible\s*{\s*outline:\s*3px solid #c4b5fd;/,
  );
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

it("reveals the priority misconception, challenge, and non-color map semantics", async () => {
  const tentativeDiagnosis: Diagnosis = {
    ...DEMO_DIAGNOSIS,
    nodes: DEMO_DIAGNOSIS.nodes.map((node, index) =>
      index === 2 ? { ...node, confidence: 0.554 } : node,
    ),
  };
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(challengeResponse())
    .mockResolvedValueOnce(diagnosisResponse(tentativeDiagnosis));
  vi.stubGlobal("fetch", fetchMock);
  const user = userEvent.setup();

  render(<RecallApp />);
  await user.click(
    await screen.findByRole("button", { name: /start sample lesson/i }),
  );
  fireEvent.change(await screen.findByLabelText(/your explanation/i), {
    target: { value: DEMO_FIRST_EXPLANATION },
  });
  await user.click(screen.getByRole("button", { name: /reveal my blind spot/i }));

  const priorityClaim = await screen.findByText(/association proves causation/i);
  const priorityNode = priorityClaim.closest("li");
  expect(priorityNode).toHaveAttribute(
    "aria-label",
    "Highest-priority learning gap",
  );
  expect(priorityNode).toHaveAttribute("data-status", "misconception");
  expect(screen.getByText(DEMO_PROBE.question)).toBeVisible();

  const map = screen.getByRole("list", { name: /reasoning map/i });
  const mapHeading = screen.getByRole("heading", {
    level: 2,
    name: "Reasoning map",
  });
  expect(map).toHaveAttribute("aria-labelledby", mapHeading.id);
  const nodes = within(map).getAllByRole("listitem");
  expect(nodes).toHaveLength(3);
  expect(nodes[0]).not.toHaveAttribute("aria-label");
  expect(nodes[2]).not.toHaveAttribute("aria-label");
  expect(nodes.map((node) => node.getAttribute("data-status"))).toEqual([
    "correct",
    "misconception",
    "incomplete",
  ]);
  for (const [index, label] of [
    "Supported",
    "Misconception",
    "Incomplete",
  ].entries()) {
    expect(within(nodes[index]).getByText(label)).toBeVisible();
    expect(within(nodes[index]).getByText("●", { exact: true })).toBeVisible();
    expect(nodes[index].querySelector("blockquote")).toBeInTheDocument();
  }
  expect(within(nodes[2]).getByText("55% confidence")).toBeVisible();
  expect(within(nodes[2]).getByText("Tentative")).toBeVisible();
});

it("moves from diagnosis to repair without losing the challenge or either explanation", async () => {
  localStorage.setItem(
    "recall.session.v1",
    JSON.stringify(
      createRestoredSession({
        stage: "diagnosis",
        diagnosis: DEMO_DIAGNOSIS,
        probe: DEMO_PROBE,
        revisedExplanation: DEMO_REVISED_EXPLANATION,
      }),
    ),
  );
  vi.stubGlobal("fetch", vi.fn());
  const user = userEvent.setup();

  render(<RecallApp />);
  await user.click(
    await screen.findByRole("button", {
      name: /work through this challenge/i,
    }),
  );

  expect(screen.getByText(DEMO_PROBE.question)).toBeVisible();
  const revised = screen.getByLabelText(/revised explanation/i);
  expect(revised).toHaveAttribute("minlength", "80");
  expect(revised).toHaveAttribute("maxlength", "4000");
  expect(revised).toHaveValue(DEMO_REVISED_EXPLANATION);
  const original = screen.getByText(/original answer/i).closest("details");
  expect(original).not.toHaveAttribute("open");
  expect(original).toHaveTextContent(LONG_EXPLANATION);

  await user.click(screen.getByRole("button", { name: /back to reasoning map/i }));
  expect(screen.getByText(/association proves causation/i)).toBeVisible();
  await user.click(
    screen.getByRole("button", { name: /work through this challenge/i }),
  );
  expect(screen.getByLabelText(/revised explanation/i)).toHaveValue(
    DEMO_REVISED_EXPLANATION,
  );
});

it("shows a repair counter and an inline minimum-length error", async () => {
  localStorage.setItem(
    "recall.session.v1",
    JSON.stringify(
      createRestoredSession({
        stage: "repair",
        diagnosis: DEMO_DIAGNOSIS,
        probe: DEMO_PROBE,
      }),
    ),
  );
  vi.stubGlobal("fetch", vi.fn());
  const user = userEvent.setup();

  render(<RecallApp />);
  const revised = await screen.findByLabelText(/revised explanation/i);
  await user.type(revised, "Still too short");

  expect(screen.getByText("15 / 4,000")).toBeVisible();
  const counter = screen.getByText("15 / 4,000");
  expect(counter).not.toHaveAttribute("aria-live");
  const guidance = screen.getByText(/at least 80 characters required/i);
  expect(guidance).toBeVisible();
  expect(guidance).toHaveAttribute("role", "status");
  expect(revised).toHaveAttribute("aria-invalid", "true");
  expect(
    screen.getByRole("button", { name: /check my repaired understanding/i }),
  ).toBeDisabled();
});

it("marks a restored explanation over 4,000 characters invalid", async () => {
  localStorage.setItem(
    "recall.session.v1",
    JSON.stringify(
      createRestoredSession({
        stage: "repair",
        diagnosis: DEMO_DIAGNOSIS,
        probe: DEMO_PROBE,
        revisedExplanation: "x".repeat(4_001),
      }),
    ),
  );
  vi.stubGlobal("fetch", vi.fn());

  render(<RecallApp />);

  const revised = await screen.findByLabelText(/revised explanation/i);
  expect(revised).toHaveAttribute("aria-invalid", "true");
  expect(screen.getByText(/1 character over the 4,000 limit/i)).toBeVisible();
  expect(
    screen.getByRole("button", { name: /check my repaired understanding/i }),
  ).toBeDisabled();
});

it("completes the mocked diagnosis, repair, and result flow", async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(challengeResponse())
    .mockResolvedValueOnce(diagnosisResponse())
    .mockResolvedValueOnce(repairResponse());
  vi.stubGlobal("fetch", fetchMock);
  const user = userEvent.setup();

  render(<RecallApp />);
  await user.click(
    await screen.findByRole("button", { name: /start sample lesson/i }),
  );
  fireEvent.change(await screen.findByLabelText(/your explanation/i), {
    target: { value: DEMO_FIRST_EXPLANATION },
  });
  await user.click(screen.getByRole("button", { name: /reveal my blind spot/i }));
  const diagnosisHeading = await screen.findByRole("heading", {
    name: "One link needs attention",
  });
  await waitFor(() => expect(diagnosisHeading).toHaveFocus());
  await user.click(
    screen.getByRole("button", { name: /work through this challenge/i }),
  );
  fireEvent.change(screen.getByLabelText(/revised explanation/i), {
    target: { value: DEMO_REVISED_EXPLANATION },
  });
  await user.click(
    screen.getByRole("button", { name: /check my repaired understanding/i }),
  );

  const resultHeading = await screen.findByRole("heading", {
    name: "Understanding repaired",
  });
  expect(resultHeading).toBeVisible();
  await waitFor(() => expect(resultHeading).toHaveFocus());
  expect(screen.getByText("Before → After")).toBeVisible();
  expect(screen.getByText(DEMO_REPAIR.before)).toBeVisible();
  expect(screen.getByText(DEMO_REPAIR.after)).toBeVisible();
  const recallCardContent = screen
    .getByRole("heading", { name: "Recall card" })
    .closest("aside")!;
  expect(within(recallCardContent).getByText(DEMO_REPAIR.recallCard)).toBeVisible();
  const result = screen.getByRole("heading", {
    name: "Understanding repaired",
  }).closest("section")!;
  const resultChildren = Array.from(result.children);
  const summary = result.querySelector(".stage-intro")!;
  const comparison = result.querySelector(".before-after")!;
  const recallCard = result.querySelector(".recall-card")!;
  const resultMap = result.querySelector(".result-map")!;
  expect(summary.nextElementSibling).toBe(comparison);
  expect(resultChildren.indexOf(comparison)).toBeLessThan(
    resultChildren.indexOf(recallCard),
  );
  expect(resultChildren.indexOf(recallCard)).toBeLessThan(
    resultChildren.indexOf(resultMap),
  );
  const repairedChange = screen
    .getByText("Previous: Misconception")
    .closest("[aria-label='Status change']");
  expect(repairedChange).not.toBeNull();
  expect(within(repairedChange as HTMLElement).getByText("Current: Supported")).toBeVisible();
  const repairedNode = repairedChange?.closest("li");
  expect(repairedNode).not.toBeNull();
  expect(
    within(repairedNode as HTMLElement).getByRole("heading", {
      name: "Correlation alone cannot establish causation.",
    }),
  ).toBeVisible();
  expect(within(repairedNode as HTMLElement).getByText(
    "The revised explanation now distinguishes association from a causal mechanism.",
  )).toBeVisible();
  expect(within(repairedNode as HTMLElement).getByText(
    DEMO_REPAIR.nodes[1].repairExplanation,
  )).toBeVisible();
  expect(
    within(repairedNode as HTMLElement).queryByRole("heading", {
      name: "Association proves causation.",
    }),
  ).not.toBeInTheDocument();
  expect(repairedNode).toHaveAttribute(
    "aria-label",
    "Previously highest-priority learning gap",
  );
  expect(within(repairedNode as HTMLElement).getByText("Repaired priority gap")).toBeVisible();
  expect(
    screen.getByRole("heading", {
      name: "Common causes, reverse causation, selection bias, and chance are alternatives.",
    }),
  ).toBeVisible();
  expect(fetchMock).toHaveBeenCalledTimes(3);
});

it("uses a neutral transfer question instead of inventing an all-correct gap", async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(challengeResponse())
    .mockResolvedValueOnce(
      diagnosisResponse(ALL_CORRECT_DIAGNOSIS, TRANSFER_PROBE),
    )
    .mockResolvedValueOnce(repairResponse(transferRepair("repaired")));
  vi.stubGlobal("fetch", fetchMock);
  const user = userEvent.setup();

  render(<RecallApp />);
  await user.click(
    await screen.findByRole("button", { name: /start sample lesson/i }),
  );
  fireEvent.change(await screen.findByLabelText(/your explanation/i), {
    target: { value: LONG_EXPLANATION },
  });
  await user.click(screen.getByRole("button", { name: /reveal my blind spot/i }));

  expect(
    await screen.findByRole("heading", {
      name: "No clear misconception found",
    }),
  ).toBeVisible();
  expect(
    screen.queryByLabelText(/highest-priority learning gap/i),
  ).not.toBeInTheDocument();
  expect(screen.getByText("Transfer question")).toBeVisible();
  expect(screen.getByText(TRANSFER_PROBE.question)).toBeVisible();
  expect(screen.getAllByText("Supported")).toHaveLength(3);
  expect(screen.queryByText("Misconception")).not.toBeInTheDocument();

  await user.click(
    screen.getByRole("button", { name: /work through this challenge/i }),
  );
  expect(screen.getByText("Transfer question")).toBeVisible();
  fireEvent.change(screen.getByLabelText(/revised explanation/i), {
    target: { value: DEMO_REVISED_EXPLANATION },
  });
  await user.click(
    screen.getByRole("button", { name: /check my repaired understanding/i }),
  );
  expect(
    await screen.findByRole("heading", { name: "Transfer confirmed" }),
  ).toBeVisible();
  expect(screen.getByText("KEEP THIS")).toBeVisible();
  expect(screen.queryByText(/priority gap/i)).not.toBeInTheDocument();
});

it.each([
  ["repaired", "Transfer confirmed", "success"],
  ["partial", "Transfer is partly supported", "warning"],
  ["not_repaired", "Transfer needs another pass", "danger"],
] as const)(
  "uses transfer-specific %s result copy and recall-card rules",
  async (overallStatus, heading, tone) => {
    localStorage.setItem(
      "recall.session.v1",
      JSON.stringify(
        createRestoredSession({
          stage: "result",
          diagnosis: ALL_CORRECT_DIAGNOSIS,
          probe: TRANSFER_PROBE,
          revisedExplanation: DEMO_REVISED_EXPLANATION,
          repair: transferRepair(overallStatus),
        }),
      ),
    );
    vi.stubGlobal("fetch", vi.fn());

    render(<RecallApp />);

    const resultHeading = await screen.findByRole("heading", { name: heading });
    const result = resultHeading.closest("section");
    expect(result).toHaveAttribute("data-tone", tone);
    expect(result?.querySelector(".stage-intro")).not.toHaveTextContent(
      /gap|repaired/i,
    );
    if (overallStatus === "repaired") {
      expect(screen.getByText("KEEP THIS")).toBeVisible();
      expect(screen.getByRole("heading", { name: "Recall card" })).toBeVisible();
    } else {
      expect(screen.queryByText("KEEP THIS")).not.toBeInTheDocument();
      expect(
        screen.queryByRole("heading", { name: "Recall card" }),
      ).not.toBeInTheDocument();
    }
  },
);

it.each([
  ["unchanged", "unchanged partial"],
  ["status-only", "status-only partial"],
] as const)(
  "rejects a %s repair response instead of rendering improvement copy",
  async (kind) => {
    localStorage.setItem(
      "recall.session.v1",
      JSON.stringify(
        createRestoredSession({
          stage: "repair",
          diagnosis: DEMO_DIAGNOSIS,
          probe: DEMO_PROBE,
          revisedExplanation: DEMO_REVISED_EXPLANATION,
        }),
      ),
    );
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(repairResponse(invalidPartialRepair(kind))),
    );
    const user = userEvent.setup();

    render(<RecallApp />);
    await user.click(
      await screen.findByRole("button", {
        name: /check my repaired understanding/i,
      }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /could not validate the learning service response/i,
    );
    expect(screen.getByLabelText(/revised explanation/i)).toHaveValue(
      DEMO_REVISED_EXPLANATION,
    );
    expect(
      screen.queryByRole("heading", { name: /a key gap is smaller/i }),
    ).not.toBeInTheDocument();
  },
);

it("preserves the exact revised explanation when verification fails and retries it", async () => {
  const pendingRetry = deferred<Response>();
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(challengeResponse())
    .mockResolvedValueOnce(diagnosisResponse())
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
    .mockReturnValueOnce(pendingRetry.promise);
  vi.stubGlobal("fetch", fetchMock);
  const user = userEvent.setup();

  render(<RecallApp />);
  await user.click(
    await screen.findByRole("button", { name: /start sample lesson/i }),
  );
  fireEvent.change(await screen.findByLabelText(/your explanation/i), {
    target: { value: DEMO_FIRST_EXPLANATION },
  });
  await user.click(screen.getByRole("button", { name: /reveal my blind spot/i }));
  await user.click(
    await screen.findByRole("button", {
      name: /work through this challenge/i,
    }),
  );
  const revised = screen.getByLabelText(/revised explanation/i);
  fireEvent.change(revised, { target: { value: DEMO_REVISED_EXPLANATION } });
  await user.click(
    screen.getByRole("button", { name: /check my repaired understanding/i }),
  );

  const retry = await screen.findByRole("button", {
    name: /retry verification/i,
  });
  expect(revised).toHaveValue(DEMO_REVISED_EXPLANATION);
  expect(screen.getByRole("alert")).toHaveTextContent(
    "Recall is temporarily unavailable. Please try again.",
  );
  expect(
    JSON.parse(localStorage.getItem("recall.session.v1") ?? "{}"),
  ).toMatchObject({
    stage: "repair",
    firstExplanation: DEMO_FIRST_EXPLANATION,
    revisedExplanation: DEMO_REVISED_EXPLANATION,
  });

  fireEvent.click(retry);
  fireEvent.click(retry);
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(4));
  expect(retry).not.toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: /checking the repair/i }),
  ).toBeDisabled();
  const retryBody = JSON.parse(
    String((fetchMock.mock.calls[3][1] as RequestInit).body),
  ) as { revisedExplanation: string };
  expect(retryBody.revisedExplanation).toBe(DEMO_REVISED_EXPLANATION);
});

it.each([
  ["partial", "A key gap is smaller"],
  ["not_repaired", "This gap still needs work"],
] as const)(
  "uses restrained copy for a %s result",
  async (overallStatus, heading) => {
    localStorage.setItem(
      "recall.session.v1",
      JSON.stringify(
        createRestoredSession({
          stage: "result",
          diagnosis: DEMO_DIAGNOSIS,
          probe: DEMO_PROBE,
          revisedExplanation: DEMO_REVISED_EXPLANATION,
          repair: repairForStatus(overallStatus),
        }),
      ),
    );
    vi.stubGlobal("fetch", vi.fn());

    render(<RecallApp />);

    expect(
      await screen.findByRole("heading", { name: heading }),
    ).toBeVisible();
    expect(screen.queryByText("KEEP THIS")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Recall card" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/congratulations|great job|celebrate/i)).not.toBeInTheDocument();
    expect(screen.queryByText("Understanding repaired")).not.toBeInTheDocument();
  },
);

it.each([
  [
    "teachback",
    CHALLENGE.prompt,
    ["Reveal my blind spot", "Back"],
    {},
  ],
  [
    "diagnosis",
    "One link needs attention",
    ["Work through this challenge", "Back to my explanation"],
    { diagnosis: DEMO_DIAGNOSIS, probe: DEMO_PROBE },
  ],
  [
    "repair",
    "Revise the explanation in your own words",
    ["Check my repaired understanding", "Back to reasoning map"],
    { diagnosis: DEMO_DIAGNOSIS, probe: DEMO_PROBE },
  ],
  [
    "result",
    "Understanding repaired",
    ["Try another concept", "Review my reasoning"],
    {
      diagnosis: DEMO_DIAGNOSIS,
      probe: DEMO_PROBE,
      revisedExplanation: DEMO_REVISED_EXPLANATION,
      repair: DEMO_REPAIR,
    },
  ],
] as const)(
  "focuses the %s heading and keeps primary action first",
  async (stage, heading, actions, overrides) => {
    localStorage.setItem(
      "recall.session.v1",
      JSON.stringify(createRestoredSession({ stage, ...overrides })),
    );
    vi.stubGlobal("fetch", vi.fn());

    render(<RecallApp />);

    const stageHeading = await screen.findByRole("heading", { name: heading });
    await waitFor(() => expect(stageHeading).toHaveFocus());
    const stageSection = stageHeading.closest("section")!;
    expect(
      Array.from(stageSection.querySelectorAll(".stage-actions button")).map(
        (button) => button.textContent?.trim(),
      ),
    ).toEqual(actions);
  },
);

it("reviews the diagnosis from a result without refetching or losing repair text", async () => {
  localStorage.setItem(
    "recall.session.v1",
    JSON.stringify(
      createRestoredSession({
        stage: "result",
        diagnosis: DEMO_DIAGNOSIS,
        probe: DEMO_PROBE,
        revisedExplanation: DEMO_REVISED_EXPLANATION,
        repair: DEMO_REPAIR,
      }),
    ),
  );
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  const user = userEvent.setup();

  render(<RecallApp />);
  await user.click(
    await screen.findByRole("button", { name: /review my reasoning/i }),
  );

  expect(screen.getByText(/association proves causation/i)).toBeVisible();
  expect(fetchMock).not.toHaveBeenCalled();
  await user.click(
    screen.getByRole("button", { name: /work through this challenge/i }),
  );
  expect(screen.getByLabelText(/revised explanation/i)).toHaveValue(
    DEMO_REVISED_EXPLANATION,
  );
});

it("starts a clean lesson from the result action", async () => {
  localStorage.setItem(
    "recall.session.v1",
    JSON.stringify(
      createRestoredSession({
        stage: "result",
        diagnosis: DEMO_DIAGNOSIS,
        probe: DEMO_PROBE,
        revisedExplanation: DEMO_REVISED_EXPLANATION,
        repair: DEMO_REPAIR,
      }),
    ),
  );
  vi.stubGlobal("fetch", vi.fn());
  const user = userEvent.setup();

  render(<RecallApp />);
  await user.click(
    await screen.findByRole("button", { name: /try another concept/i }),
  );

  expect(
    screen.getByRole("button", { name: /start sample lesson/i }),
  ).toBeEnabled();
  expect(screen.queryByText(DEMO_REPAIR.recallCard)).not.toBeInTheDocument();
});

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
