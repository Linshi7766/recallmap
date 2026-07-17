import type { Diagnosis, RepairResult } from "./contracts";
import { ModelOutputValidationError } from "./output-validation";

function normalizeStatement(value: string): string {
  return value
    .toLocaleLowerCase()
    .replaceAll(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function failRepairInvariant(message: string): never {
  throw new ModelOutputValidationError("repair_invariant_failed", message);
}

export function assertRepairMatchesDiagnosis(
  diagnosis: Diagnosis,
  repair: RepairResult,
): void {
  const priorityNodeId = diagnosis.priorityNodeId;
  if (
    priorityNodeId !== null &&
    !repair.nodes.some((node) => node.id === priorityNodeId)
  ) {
    failRepairInvariant("Repair must preserve the priority node identity.");
  }

  const preservesTopology =
    repair.nodes.length === diagnosis.nodes.length &&
    repair.nodes.every((node, index) => node.id === diagnosis.nodes[index]?.id);
  if (!preservesTopology) {
    failRepairInvariant("Repair must preserve diagnosis node IDs and order.");
  }

  for (const [index, node] of repair.nodes.entries()) {
    const original = diagnosis.nodes[index]!;
    if (node.previousStatus !== original.status) {
      failRepairInvariant(
        `Repair previousStatus must match the diagnosis for ${node.id}.`,
      );
    }
  }

  if (priorityNodeId !== null) {
    const originalPriorityNode = diagnosis.nodes.find(
      (node) => node.id === priorityNodeId,
    )!;
    const priorityNode = repair.nodes.find(
      (node) => node.id === priorityNodeId,
    )!;
    const expectedStatus =
      priorityNode.status === "correct"
        ? "repaired"
        : originalPriorityNode.status === "misconception" &&
            priorityNode.status === "incomplete"
          ? "partial"
          : "not_repaired";
    if (repair.overallStatus !== expectedStatus) {
      failRepairInvariant(
        "Repair overall status must agree with the current priority status.",
      );
    }
  } else {
    const correctNodeCount = repair.nodes.filter(
      (node) => node.status === "correct",
    ).length;
    const expectedStatus =
      correctNodeCount === repair.nodes.length
        ? "repaired"
        : correctNodeCount > 0
          ? "partial"
          : "not_repaired";
    if (repair.overallStatus !== expectedStatus) {
      failRepairInvariant("Transfer status must agree with the current nodes.");
    }
  }

  for (const [index, node] of repair.nodes.entries()) {
    const original = diagnosis.nodes[index]!;
    if (original.status !== node.status) {
      const claimChanged =
        normalizeStatement(node.claim) !== normalizeStatement(original.claim);
      const diagnosisChanged =
        normalizeStatement(node.diagnosis) !==
        normalizeStatement(original.diagnosis);
      if (!claimChanged || !diagnosisChanged) {
        failRepairInvariant(
          `A status change for ${node.id} must change both claim and diagnosis.`,
        );
      }
    }
  }

  if (repair.overallStatus === "repaired" && repair.recallCard !== null) {
    const normalizedCard = normalizeStatement(repair.recallCard);
    const repeatsNonCorrectClaim = diagnosis.nodes
      .filter((node) => node.status !== "correct")
      .some((node) => normalizedCard.includes(normalizeStatement(node.claim)));
    if (repeatsNonCorrectClaim) {
      failRepairInvariant(
        "A repaired recall card must not repeat an original non-correct claim.",
      );
    }

    const matchesSupportedClaim = repair.nodes.some(
      (node) =>
        node.status === "correct" &&
        normalizeStatement(node.claim) === normalizedCard,
    );
    if (!matchesSupportedClaim) {
      failRepairInvariant(
        "A repaired recall card must exactly match a supported current claim.",
      );
    }
  }
}
