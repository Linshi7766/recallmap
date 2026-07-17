import { describe, expect, it } from "vitest";
import type {
  Challenge,
  Diagnosis,
  Probe,
  RepairResult,
} from "@/lib/domain/contracts";
import { SAMPLE_LESSON } from "@/lib/domain/sample-lesson";
import {
  createLearningSession,
  learningSessionReducer,
  restoreSession,
  serializeSession,
  type LearningEvent,
} from "@/lib/domain/session";

const SESSION_ID = "11111111-1111-4111-8111-111111111111";

const CHALLENGE: Challenge = {
  lessonTitle: "Correlation vs. Causation",
  concept: "Causal inference",
  prompt: "Explain why correlation alone cannot prove causation.",
  evidencePassages: [
    "Correlation alone does not identify the mechanism that produced an association.",
  ],
};

const NODES = [1, 2, 3].map((index) => ({
  id: `node-${index}` as "node-1" | "node-2" | "node-3",
  claim: `Reasoning claim ${index}`,
  status: index === 1 ? ("misconception" as const) : ("correct" as const),
  diagnosis: "This reasoning needs a more careful causal explanation.",
  evidence: "Correlation alone does not identify the mechanism that produced an association.",
  confidence: 0.9,
}));

const DIAGNOSIS: Diagnosis = { nodes: NODES, priorityNodeId: "node-1" };

const PROBE: Probe = {
  question: "What alternative explanation could make two variables move together?",
  evaluationTarget: "Distinguishes association from causal mechanism.",
};

const REPAIR: RepairResult = {
  nodes: NODES.map((node) => ({
    ...node,
    status: "correct" as const,
    previousStatus: node.status,
    repairExplanation: "The revision rules out correlation as proof of direct causation.",
  })),
  overallStatus: "repaired",
  before: "Correlation proves causation whenever two variables move together.",
  after: "Correlation can have multiple explanations, so it alone cannot prove causation.",
  recallCard: "Correlation is an association; identify alternative causal explanations before inferring cause.",
};

function atTeachback() {
  return learningSessionReducer(
    learningSessionReducer(createLearningSession(SESSION_ID), {
      type: "SOURCE_SELECTED",
      source: SAMPLE_LESSON,
    }),
    { type: "CHALLENGE_READY", challenge: CHALLENGE },
  );
}

function atDiagnosis() {
  return learningSessionReducer(
    learningSessionReducer(atTeachback(), {
      type: "FIRST_EXPLANATION_CHANGED",
      value: "Correlation proves causation whenever two variables move together.",
    }),
    { type: "DIAGNOSIS_READY", diagnosis: DIAGNOSIS, probe: PROBE },
  );
}

function atRepair() {
  return learningSessionReducer(atDiagnosis(), {
    type: "REVISED_EXPLANATION_CHANGED",
    value: "Correlation can have multiple explanations, so it alone cannot prove causation.",
  });
}

function atResult() {
  return learningSessionReducer(atRepair(), { type: "REPAIR_READY", repair: REPAIR });
}

describe("learning session", () => {
  it("moves from start to teachback only after a selected source receives a challenge", () => {
    const start = createLearningSession(SESSION_ID);
    expect(learningSessionReducer(start, { type: "CHALLENGE_READY", challenge: CHALLENGE })).toBe(start);

    const selected = learningSessionReducer(start, {
      type: "SOURCE_SELECTED",
      source: SAMPLE_LESSON,
    });
    expect(selected.stage).toBe("start");
    expect(selected.source).toEqual(SAMPLE_LESSON);

    expect(learningSessionReducer(selected, { type: "CHALLENGE_READY", challenge: CHALLENGE })).toMatchObject({
      stage: "teachback",
      challenge: CHALLENGE,
    });
  });

  it("keeps the first explanation only during teachback", () => {
    const start = createLearningSession(SESSION_ID);
    expect(learningSessionReducer(start, { type: "FIRST_EXPLANATION_CHANGED", value: "unsafe" })).toBe(start);

    expect(learningSessionReducer(atTeachback(), {
      type: "FIRST_EXPLANATION_CHANGED",
      value: "My initial explanation.",
    })).toMatchObject({ stage: "teachback", firstExplanation: "My initial explanation." });
  });

  it("moves from teachback to diagnosis only when diagnosis data arrives", () => {
    const teachback = atTeachback();
    expect(learningSessionReducer(teachback, { type: "REPAIR_READY", repair: REPAIR })).toBe(teachback);

    expect(learningSessionReducer(teachback, {
      type: "DIAGNOSIS_READY",
      diagnosis: DIAGNOSIS,
      probe: PROBE,
    })).toMatchObject({ stage: "diagnosis", diagnosis: DIAGNOSIS, probe: PROBE });
  });

  it("moves from diagnosis to repair when the revised explanation is started and keeps later edits", () => {
    const diagnosis = atDiagnosis();
    const repair = learningSessionReducer(diagnosis, {
      type: "REVISED_EXPLANATION_CHANGED",
      value: "First revision.",
    });
    expect(repair).toMatchObject({ stage: "repair", revisedExplanation: "First revision." });

    expect(learningSessionReducer(repair, {
      type: "REVISED_EXPLANATION_CHANGED",
      value: "Second revision.",
    })).toMatchObject({ stage: "repair", revisedExplanation: "Second revision." });
  });

  it("moves from repair to result only when repair data arrives", () => {
    const repair = atRepair();
    expect(learningSessionReducer(repair, { type: "DIAGNOSIS_READY", diagnosis: DIAGNOSIS, probe: PROBE })).toBe(repair);

    expect(learningSessionReducer(repair, { type: "REPAIR_READY", repair: REPAIR })).toMatchObject({
      stage: "result",
      repair: REPAIR,
    });
  });

  it("leaves every out-of-order forward event unchanged", () => {
    const events: LearningEvent[] = [
      { type: "SOURCE_SELECTED", source: SAMPLE_LESSON },
      { type: "CHALLENGE_READY", challenge: CHALLENGE },
      { type: "FIRST_EXPLANATION_CHANGED", value: "unsafe" },
      { type: "DIAGNOSIS_READY", diagnosis: DIAGNOSIS, probe: PROBE },
      { type: "REVISED_EXPLANATION_CHANGED", value: "unsafe" },
      { type: "REPAIR_READY", repair: REPAIR },
    ];
    const allowedTypes = {
      start: ["SOURCE_SELECTED"],
      teachback: ["FIRST_EXPLANATION_CHANGED", "DIAGNOSIS_READY"],
      diagnosis: ["REVISED_EXPLANATION_CHANGED"],
      repair: ["REVISED_EXPLANATION_CHANGED", "REPAIR_READY"],
      result: [],
    } as const;
    const sessions = [
      createLearningSession(SESSION_ID),
      atTeachback(),
      atDiagnosis(),
      atRepair(),
      atResult(),
    ];

    for (const session of sessions) {
      for (const event of events) {
        if (!allowedTypes[session.stage].includes(event.type as never)) {
          expect(learningSessionReducer(session, event)).toBe(session);
        }
      }
    }
  });

  it("maps BACK through every stage without deleting text, diagnosis, or repair results", () => {
    const result = atResult();
    const repair = learningSessionReducer(result, { type: "BACK" });
    const diagnosis = learningSessionReducer(repair, { type: "BACK" });
    const teachback = learningSessionReducer(diagnosis, { type: "BACK" });
    const start = learningSessionReducer(teachback, { type: "BACK" });

    expect([repair.stage, diagnosis.stage, teachback.stage, start.stage]).toEqual([
      "repair",
      "diagnosis",
      "teachback",
      "start",
    ]);
    for (const session of [repair, diagnosis, teachback, start]) {
      expect(session.firstExplanation).toBe(result.firstExplanation);
      expect(session.revisedExplanation).toBe(result.revisedExplanation);
      expect(session.diagnosis).toEqual(DIAGNOSIS);
      expect(session.probe).toEqual(PROBE);
      expect(session.repair).toEqual(REPAIR);
    }
    expect(learningSessionReducer(start, { type: "BACK" })).toBe(start);
  });

  it("resets all learning data while preserving the session UUID", () => {
    const reset = learningSessionReducer(atResult(), { type: "RESET" });

    expect(reset).toEqual(createLearningSession(SESSION_ID));
    expect(reset.id).toBe(SESSION_ID);
  });

  it("serializes and restores a valid session", () => {
    const session = atResult();
    expect(restoreSession(serializeSession(session))).toEqual(session);
  });

  it("returns null for corrupt, structurally invalid, and outdated stored sessions", () => {
    expect(restoreSession("not-json")).toBeNull();
    expect(restoreSession(JSON.stringify({ version: 1, id: SESSION_ID }))).toBeNull();
    expect(restoreSession(JSON.stringify({ ...atResult(), version: 2 }))).toBeNull();
  });
});
