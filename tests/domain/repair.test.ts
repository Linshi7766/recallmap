import { describe, expect, it } from "vitest";
import type { Diagnosis, RepairResult } from "@/lib/domain/contracts";
import { assertRepairMatchesDiagnosis } from "@/lib/domain/repair";
import {
  DEMO_DIAGNOSIS,
  DEMO_REPAIR,
} from "@/lib/fixtures/demo-fallback";

const diagnosis: Diagnosis = {
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

const repair: RepairResult = {
  nodes: diagnosis.nodes.map((node) => ({
    ...node,
    previousStatus: node.status,
    repairExplanation:
      "The transfer response preserves this source-supported reasoning link.",
  })),
  overallStatus: "repaired",
  before:
    "Correlation describes how two variables vary together, but causation requires added evidence that rules out alternative explanations.",
  after:
    "I would check shared holiday demand, promotions, and timing before deciding whether either product caused the other's sales increase.",
  recallCard: diagnosis.nodes[2]!.claim,
};

describe("repair semantic validation", () => {
  it("accepts a coherent all-correct transfer result", () => {
    expect(() => assertRepairMatchesDiagnosis(diagnosis, repair)).not.toThrow();
  });

  it("rejects a recall card that is not a supported current claim", () => {
    expect(() =>
      assertRepairMatchesDiagnosis(diagnosis, {
        ...repair,
        recallCard: "A plausible but unsupported transfer-memory statement.",
      }),
    ).toThrow(/recall card.*supported current claim/i);
  });

  it("rejects unchanged priority reasoning labeled partial", () => {
    const unchanged: RepairResult = {
      ...DEMO_REPAIR,
      nodes: DEMO_DIAGNOSIS.nodes.map((node) => ({
        ...node,
        previousStatus: node.status,
        repairExplanation: "The response leaves this reasoning link unchanged.",
      })),
      overallStatus: "partial",
      recallCard: null,
    };

    expect(() =>
      assertRepairMatchesDiagnosis(DEMO_DIAGNOSIS, unchanged),
    ).toThrow(/overall status.*priority/i);
  });

  it("rejects a status-only partial improvement", () => {
    const relabeled: RepairResult = {
      ...DEMO_REPAIR,
      nodes: DEMO_DIAGNOSIS.nodes.map((node, index) => ({
        ...node,
        previousStatus: node.status,
        status: index === 1 ? ("incomplete" as const) : node.status,
        repairExplanation: "The response records the current reasoning link.",
      })),
      overallStatus: "partial",
      recallCard: null,
    };

    expect(() =>
      assertRepairMatchesDiagnosis(DEMO_DIAGNOSIS, relabeled),
    ).toThrow(/status change.*both claim and diagnosis/i);
  });

  it("accepts a priority misconception that genuinely improves to incomplete", () => {
    const partial: RepairResult = {
      ...DEMO_REPAIR,
      nodes: DEMO_DIAGNOSIS.nodes.map((node, index) =>
        index === 1
          ? {
              ...node,
              previousStatus: node.status,
              status: "incomplete" as const,
              claim:
                "Correlation alone is insufficient, but the required causal evidence is not yet stated.",
              diagnosis:
                "The causal leap is removed, while the evidentiary standard remains incomplete.",
              repairExplanation:
                "The response rejects the original misconception but remains incomplete.",
            }
          : {
              ...node,
              previousStatus: node.status,
              repairExplanation: "The response preserves this reasoning link.",
            },
      ),
      overallStatus: "partial",
      recallCard: null,
    };

    expect(() =>
      assertRepairMatchesDiagnosis(DEMO_DIAGNOSIS, partial),
    ).not.toThrow();
  });

  it.each([
    ["not_repaired", ["correct", "incomplete", "misconception"]],
    ["partial", ["incomplete", "misconception", "incomplete"]],
  ] as const)(
    "rejects a transfer labeled %s when its node distribution says otherwise",
    (overallStatus, statuses) => {
      const mislabeled: RepairResult = {
        ...repair,
        nodes: repair.nodes.map((node, index) => ({
          ...node,
          status: statuses[index]!,
          claim:
            statuses[index] === "correct"
              ? node.claim
              : `Transfer reasoning ${index + 1} is not yet supported.`,
          diagnosis:
            statuses[index] === "correct"
              ? node.diagnosis
              : `The transfer response leaves reasoning link ${index + 1} unsupported.`,
        })),
        overallStatus,
        recallCard: null,
      };

      expect(() =>
        assertRepairMatchesDiagnosis(diagnosis, mislabeled),
      ).toThrow(/transfer status.*current nodes/i);
    },
  );
});
