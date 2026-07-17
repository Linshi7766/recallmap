import {
  ChallengeSchema,
  DiagnosisSchema,
  ProbeSchema,
  RepairResultSchema,
  type LearningRequest,
} from "@/lib/domain/contracts";
import {
  DEMO_FIRST_EXPLANATION,
  DEMO_REVISED_EXPLANATION,
  SAMPLE_LESSON,
} from "@/lib/domain/sample-lesson";

function deepFreeze<T>(value: T): Readonly<T> {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) {
      deepFreeze(child);
    }
  }
  return value;
}

function isExactValue(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) {
    return true;
  }
  if (
    typeof left !== "object" ||
    left === null ||
    typeof right !== "object" ||
    right === null
  ) {
    return false;
  }

  if (Array.isArray(left) || Array.isArray(right)) {
    return (
      Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((item, index) => isExactValue(item, right[index]))
    );
  }

  const leftRecord = left as Record<string, unknown>;
  const rightRecord = right as Record<string, unknown>;
  const leftKeys = Object.keys(leftRecord);
  const rightKeys = Object.keys(rightRecord);
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every(
      (key) =>
        Object.prototype.hasOwnProperty.call(rightRecord, key) &&
        isExactValue(leftRecord[key], rightRecord[key]),
    )
  );
}

export const DEMO_CHALLENGE = deepFreeze(
  ChallengeSchema.parse({
    lessonTitle: SAMPLE_LESSON.title,
    concept: "Correlation and causation",
    prompt:
      "Explain why ice-cream sales and drowning incidents can move together without one causing the other.",
    evidencePassages: [
      "Their correlation does not mean that buying ice cream causes drowning; temperature is a common cause that influences both variables.",
    ],
  }),
);

export const DEMO_DIAGNOSIS = deepFreeze(
  DiagnosisSchema.parse({
    nodes: [
      {
        id: "node-1",
        claim: "The variables move together.",
        status: "correct",
        diagnosis: "This correctly identifies an association.",
        evidence: "Correlation measures how two variables vary together.",
        confidence: 0.95,
      },
      {
        id: "node-2",
        claim: "Association proves causation.",
        status: "misconception",
        diagnosis: "Association alone does not establish the causal mechanism.",
        evidence:
          "Correlation alone does not identify the mechanism that produced an association.",
        confidence: 0.9,
      },
      {
        id: "node-3",
        claim: "Data error is the only alternative explanation.",
        status: "incomplete",
        diagnosis: "The explanation omits several plausible alternatives.",
        evidence:
          "An association may arise because one variable causes the other, because causation runs in the reverse direction, because a third variable affects both, because of selection bias, or because of chance.",
        confidence: 0.85,
      },
    ],
    priorityNodeId: "node-2",
  }),
);

export const DEMO_PROBE = deepFreeze(
  ProbeSchema.parse({
    question:
      "If hot weather raises both ice-cream sales and drowning incidents, what does that show about the claimed causal link?",
    evaluationTarget: "Whether the learner can identify a common cause.",
  }),
);

export const DEMO_REPAIR = deepFreeze(
  RepairResultSchema.parse({
    nodes: [
      {
        ...DEMO_DIAGNOSIS.nodes[0],
        previousStatus: "correct",
        status: "correct",
        repairExplanation: "The revised explanation preserves this accurate observation.",
      },
      {
        ...DEMO_DIAGNOSIS.nodes[1],
        previousStatus: "misconception",
        status: "correct",
        repairExplanation:
          "The revision explains that association alone cannot establish causation.",
      },
      {
        ...DEMO_DIAGNOSIS.nodes[2],
        previousStatus: "incomplete",
        status: "correct",
        repairExplanation:
          "The revision names common causes and other alternative explanations.",
      },
    ],
    overallStatus: "repaired",
    before: DEMO_FIRST_EXPLANATION,
    after: DEMO_REVISED_EXPLANATION,
    recallCard:
      "Correlation describes co-variation; causation needs evidence that rules out plausible alternatives.",
  }),
);

export function getDemoFallback(request: LearningRequest): unknown | null {
  if (!isExactValue(request.source, SAMPLE_LESSON)) {
    return null;
  }

  if (request.operation === "generate_challenge") {
    return DEMO_CHALLENGE;
  }

  if (
    request.operation === "diagnose" &&
    request.firstExplanation === DEMO_FIRST_EXPLANATION &&
    isExactValue(request.challenge, DEMO_CHALLENGE)
  ) {
    return { diagnosis: DEMO_DIAGNOSIS, probe: DEMO_PROBE };
  }

  if (
    request.operation === "verify" &&
    request.firstExplanation === DEMO_FIRST_EXPLANATION &&
    request.revisedExplanation === DEMO_REVISED_EXPLANATION &&
    isExactValue(request.diagnosis, DEMO_DIAGNOSIS) &&
    isExactValue(request.probe, DEMO_PROBE)
  ) {
    return DEMO_REPAIR;
  }

  return null;
}
