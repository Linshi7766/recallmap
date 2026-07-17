import { callStructured } from "@/lib/ai/client";
import {
  challengeInstructions,
  diagnosisInstructions,
  probeInstructions,
  repairInstructions,
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

export async function generateChallenge(
  input: SessionInput,
  call: StructuredCaller = callStructured,
): Promise<Challenge> {
  return call({
    schema: ChallengeSchema,
    schemaName: "recall_challenge",
    instructions: challengeInstructions,
    input: wrapStudyMaterial(input.source.text),
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
      wrapStudyMaterial(input.source.text),
      `<challenge>\n${JSON.stringify(input.challenge)}\n</challenge>`,
      `<student_explanation>\n${input.firstExplanation}\n</student_explanation>`,
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
      wrapStudyMaterial(input.source.text),
      `<student_explanation>\n${input.firstExplanation}\n</student_explanation>`,
      `<priority_node>\n${JSON.stringify(input.priorityNode)}\n</priority_node>`,
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
      wrapStudyMaterial(input.source.text),
      `<original_student_explanation>\n${input.firstExplanation}\n</original_student_explanation>`,
      `<revised_student_explanation>\n${input.revisedExplanation}\n</revised_student_explanation>`,
      `<diagnosis>\n${JSON.stringify(input.diagnosis)}\n</diagnosis>`,
      `<probe>\n${JSON.stringify(input.probe)}\n</probe>`,
    ].join("\n"),
    safetyIdentifier: input.sessionId,
    validate: (value) =>
      assertEvidenceGrounded(
        input.source.text,
        value.nodes.map((node) => node.evidence),
      ),
  });
}
