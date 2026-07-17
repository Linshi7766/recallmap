import { describe, expect, it } from "vitest";
import { DiagnosisSchema, LessonSourceSchema } from "@/lib/domain/contracts";

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
});
