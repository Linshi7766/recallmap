import { describe, expect, it } from "vitest";
import {
  DiagnoseRequestSchema,
  DiagnosisSchema,
  GenerateChallengeRequestSchema,
  LessonSourceSchema,
  LearningRequestSchema,
  VerifyRequestSchema,
} from "@/lib/domain/contracts";

const SESSION_ID = "123e4567-e89b-12d3-a456-426614174000";
const explanation = (length = 80) => "e".repeat(length);

function source() {
  return {
    id: "source-1",
    kind: "pasted" as const,
    title: "A valid source",
    text: "Source material ".repeat(20),
  };
}

function challenge() {
  return {
    lessonTitle: "A valid lesson",
    concept: "Causation",
    prompt: "Explain how this evidence supports a causal claim.",
    evidencePassages: ["Correlation measures association."],
  };
}

function mixedDiagnosis() {
  return {
    nodes: [
      {
        id: "node-1",
        claim: "Variables move together",
        status: "correct" as const,
        diagnosis: "This observation is supported.",
        evidence: "Correlation measures association.",
        confidence: 0.9,
      },
      {
        id: "node-2",
        claim: "Association may need more evidence",
        status: "incomplete" as const,
        diagnosis: "The explanation omits alternative causes.",
        evidence: "Correlation alone does not identify the mechanism.",
        confidence: 0.8,
      },
      {
        id: "node-3",
        claim: "Correlation proves direct causation",
        status: "misconception" as const,
        diagnosis: "This inference is not supported by the source.",
        evidence: "An association may arise because a third variable affects both.",
        confidence: 0.95,
      },
    ],
    priorityNodeId: "node-2",
  };
}

function probe() {
  return {
    question: "What other factor could explain this association?",
    evaluationTarget: "Distinguishes correlation from causation.",
  };
}

function generateRequest() {
  return {
    operation: "generate_challenge" as const,
    sessionId: SESSION_ID,
    source: source(),
  };
}

function diagnoseRequest(firstExplanation = explanation()) {
  return {
    operation: "diagnose" as const,
    sessionId: SESSION_ID,
    source: source(),
    challenge: challenge(),
    firstExplanation,
  };
}

function verifyRequest(
  firstExplanation = explanation(),
  revisedExplanation = explanation(),
) {
  return {
    operation: "verify" as const,
    sessionId: SESSION_ID,
    source: source(),
    firstExplanation,
    diagnosis: mixedDiagnosis(),
    probe: probe(),
    revisedExplanation,
  };
}

describe("domain contracts", () => {
  it("rejects study material longer than 12,000 characters", () => {
    expect(() =>
      LessonSourceSchema.parse({
        id: "x",
        kind: "pasted",
        title: "X",
        text: "a".repeat(12_001),
      }),
    ).toThrow();
  });

  it("requires three to five reasoning nodes", () => {
    expect(() =>
      DiagnosisSchema.parse({ nodes: [], priorityNodeId: "n1" }),
    ).toThrow();
  });

  it("accepts a null priority only when every node is correct", () => {
    const nodes = [1, 2, 3].map((index) => ({
      id: `node-${index}`,
      claim: `Supported claim ${index}`,
      status: "correct" as const,
      diagnosis: "Supported by the supplied material",
      evidence: "Correlation measures association.",
      confidence: 0.9,
    }));
    expect(() =>
      DiagnosisSchema.parse({ nodes, priorityNodeId: null }),
    ).not.toThrow();
    expect(() =>
      DiagnosisSchema.parse({ nodes, priorityNodeId: "node-1" }),
    ).toThrow();
  });

  it.each([
    ["a non-correct node", "node-2", true],
    ["null", null, false],
    ["a correct node", "node-1", false],
    ["an absent node", "node-4", false],
  ])(
    "requires mixed diagnoses to prioritize %s",
    (_description, priorityNodeId, expected) => {
      const result = DiagnosisSchema.safeParse({
        ...mixedDiagnosis(),
        priorityNodeId,
      });

      expect(result.success).toBe(expected);
    },
  );

  it.each([
    ["generate challenge", generateRequest],
    ["diagnose", diagnoseRequest],
    ["verify", verifyRequest],
  ])("accepts a valid %s request", (_name, createRequest) => {
    expect(() => LearningRequestSchema.parse(createRequest())).not.toThrow();
  });

  it.each([
    ["generate challenge", GenerateChallengeRequestSchema, () => ({ ...generateRequest(), firstExplanation: explanation() })],
    ["diagnose", DiagnoseRequestSchema, () => ({ ...diagnoseRequest(), probe: probe() })],
    ["verify", VerifyRequestSchema, () => ({ ...verifyRequest(), challenge: challenge() })],
  ])("rejects extra top-level fields for %s requests", (_name, schema, createRequest) => {
    expect(() => schema.parse(createRequest())).toThrow();
  });

  it.each([
    ["generate challenge", GenerateChallengeRequestSchema, generateRequest, "source"],
    ["diagnose", DiagnoseRequestSchema, diagnoseRequest, "firstExplanation"],
    ["verify", VerifyRequestSchema, verifyRequest, "revisedExplanation"],
  ])("rejects a missing required %s request field", (_name, schema, createRequest, field) => {
    const request = createRequest() as Record<string, unknown>;
    delete request[field];

    expect(() => schema.parse(request)).toThrow();
  });

  it("rejects an unknown operation discriminant", () => {
    expect(() =>
      LearningRequestSchema.parse({ ...generateRequest(), operation: "unknown" }),
    ).toThrow();
  });

  it("rejects an invalid request session UUID", () => {
    expect(() =>
      GenerateChallengeRequestSchema.parse({
        ...generateRequest(),
        sessionId: "not-a-uuid",
      }),
    ).toThrow();
  });

  it.each([
    ["diagnose first explanation", DiagnoseRequestSchema, (length: number) => diagnoseRequest(explanation(length))],
    ["verify first explanation", VerifyRequestSchema, (length: number) => verifyRequest(explanation(length))],
    ["verify revised explanation", VerifyRequestSchema, (length: number) => verifyRequest(explanation(), explanation(length))],
  ])("enforces 80 to 4,000 characters for %s", (_name, schema, createRequest) => {
    for (const [length, expected] of [
      [79, false],
      [80, true],
      [4_000, true],
      [4_001, false],
    ]) {
      expect(schema.safeParse(createRequest(length)).success).toBe(expected);
    }
  });
});
