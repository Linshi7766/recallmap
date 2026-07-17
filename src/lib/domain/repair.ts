import type { Diagnosis, RepairResult } from "./contracts";

function normalizeStatement(value: string): string {
  return value
    .toLocaleLowerCase()
    .replaceAll(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
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
    throw new Error("Repair must preserve the priority node identity.");
  }

  const preservesTopology =
    repair.nodes.length === diagnosis.nodes.length &&
    repair.nodes.every((node, index) => node.id === diagnosis.nodes[index]?.id);
  if (!preservesTopology) {
    throw new Error("Repair must preserve diagnosis node IDs and order.");
  }

  for (const [index, node] of repair.nodes.entries()) {
    const original = diagnosis.nodes[index]!;
    if (node.previousStatus !== original.status) {
      throw new Error(
        `Repair previousStatus must match the diagnosis for ${node.id}.`,
      );
    }
  }

  if (priorityNodeId !== null) {
    const priorityNode = repair.nodes.find(
      (node) => node.id === priorityNodeId,
    )!;
    const priorityIsCorrect = priorityNode.status === "correct";
    const outcomeIsRepaired = repair.overallStatus === "repaired";
    if (priorityIsCorrect !== outcomeIsRepaired) {
      throw new Error(
        "Repair overall status must agree with the current priority status.",
      );
    }
  } else {
    const allNodesAreCorrect = repair.nodes.every(
      (node) => node.status === "correct",
    );
    const outcomeIsConfirmed = repair.overallStatus === "repaired";
    if (allNodesAreCorrect !== outcomeIsConfirmed) {
      throw new Error("Transfer status must agree with the current nodes.");
    }
  }

  for (const [index, node] of repair.nodes.entries()) {
    const original = diagnosis.nodes[index]!;
    if (original.status !== "correct" && node.status === "correct") {
      const claimChanged =
        normalizeStatement(node.claim) !== normalizeStatement(original.claim);
      const diagnosisChanged =
        normalizeStatement(node.diagnosis) !==
        normalizeStatement(original.diagnosis);
      if (!claimChanged || !diagnosisChanged) {
        throw new Error(
          `A repaired ${node.id} must change both claim and diagnosis.`,
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
      throw new Error(
        "A repaired recall card must not repeat an original non-correct claim.",
      );
    }

    const matchesSupportedClaim = repair.nodes.some(
      (node) =>
        node.status === "correct" &&
        normalizeStatement(node.claim) === normalizedCard,
    );
    if (!matchesSupportedClaim) {
      throw new Error(
        "A repaired recall card must exactly match a supported current claim.",
      );
    }
  }
}
