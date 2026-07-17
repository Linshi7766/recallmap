import { callStructured } from "@/lib/ai/client";
import {
  challengeInstructions,
  diagnosisInstructions,
  probeInstructions,
  repairInstructions,
  serializeModelPayload,
  wrapStudyMaterial,
} from "@/lib/ai/prompts";
import {
  ChallengeSchema,
  DiagnosisSchema,
  ProbeSchema,
  RepairResultSchema,
  type Challenge,
  type Diagnosis,
  type LessonSource,
  type Probe,
  type ReasoningNode,
  type RepairResult,
} from "@/lib/domain/contracts";
import { assertEvidenceGrounded } from "@/lib/domain/evidence";

export type StructuredCaller = typeof callStructured;

type SessionInput = {
  source: LessonSource;
  sessionId: string;
};

function normalizeStatement(value: string): string {
  return value
    .toLocaleLowerCase()
    .replaceAll(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function assertRepairMatchesDiagnosis(
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
      throw new Error(
        "Transfer status must agree with the current nodes.",
      );
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
      .some((node) =>
        normalizedCard.includes(normalizeStatement(node.claim)),
      );
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

export async function generateChallenge(
  input: SessionInput,
  call: StructuredCaller = callStructured,
): Promise<Challenge> {
  return call({
    schema: ChallengeSchema,
    schemaName: "recall_challenge",
    instructions: challengeInstructions,
    input: wrapStudyMaterial(serializeModelPayload(input.source.text)),
    safetyIdentifier: input.sessionId,
    validate: (value) =>
      assertEvidenceGrounded(input.source.text, value.evidencePassages),
  });
}

export async function diagnoseExplanation(
  input: SessionInput & {
    challenge: Challenge;
    firstExplanation: string;
  },
  call: StructuredCaller = callStructured,
): Promise<Diagnosis> {
  return call({
    schema: DiagnosisSchema,
    schemaName: "recall_diagnosis",
    instructions: diagnosisInstructions,
    input: [
      wrapStudyMaterial(serializeModelPayload(input.source.text)),
      `<challenge>\n${serializeModelPayload(input.challenge)}\n</challenge>`,
      `<student_explanation>\n${serializeModelPayload(input.firstExplanation)}\n</student_explanation>`,
    ].join("\n"),
    safetyIdentifier: input.sessionId,
    validate: (value) =>
      assertEvidenceGrounded(
        input.source.text,
        value.nodes.map((node) => node.evidence),
      ),
  });
}

export async function generateChallengeProbe(
  input: SessionInput & {
    firstExplanation: string;
    priorityNode: ReasoningNode | null;
  },
  call: StructuredCaller = callStructured,
): Promise<Probe> {
  return call({
    schema: ProbeSchema,
    schemaName: "recall_probe",
    instructions: probeInstructions(input.priorityNode),
    input: [
      wrapStudyMaterial(serializeModelPayload(input.source.text)),
      `<student_explanation>\n${serializeModelPayload(input.firstExplanation)}\n</student_explanation>`,
      `<priority_node>\n${serializeModelPayload(input.priorityNode)}\n</priority_node>`,
    ].join("\n"),
    safetyIdentifier: input.sessionId,
  });
}

export async function verifyRepair(
  input: SessionInput & {
    firstExplanation: string;
    revisedExplanation: string;
    diagnosis: Diagnosis;
    probe: Probe;
  },
  call: StructuredCaller = callStructured,
): Promise<RepairResult> {
  return call({
    schema: RepairResultSchema,
    schemaName: "recall_repair",
    instructions: repairInstructions,
    input: [
      wrapStudyMaterial(serializeModelPayload(input.source.text)),
      `<original_explanation>\n${serializeModelPayload(input.firstExplanation)}\n</original_explanation>`,
      `<revised_explanation>\n${serializeModelPayload(input.revisedExplanation)}\n</revised_explanation>`,
      `<diagnosis>\n${serializeModelPayload(input.diagnosis)}\n</diagnosis>`,
      `<probe>\n${serializeModelPayload(input.probe)}\n</probe>`,
    ].join("\n"),
    safetyIdentifier: input.sessionId,
    validate: (value) => {
      assertRepairMatchesDiagnosis(input.diagnosis, value);
      assertEvidenceGrounded(
        input.source.text,
        value.nodes.map((node) => node.evidence),
      );
    },
  });
}
