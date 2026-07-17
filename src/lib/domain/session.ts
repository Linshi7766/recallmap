import { z } from "zod";
import {
  ChallengeSchema,
  DiagnosisSchema,
  LessonSourceSchema,
  ProbeSchema,
  RepairResultSchema,
  type Challenge,
  type Diagnosis,
  type LessonSource,
  type Probe,
  type RepairResult,
} from "./contracts";

export type LearningStage =
  | "start"
  | "teachback"
  | "diagnosis"
  | "repair"
  | "result";

export interface LearningSession {
  version: 1;
  id: string;
  stage: LearningStage;
  source: LessonSource | null;
  challenge: Challenge | null;
  firstExplanation: string;
  diagnosis: Diagnosis | null;
  probe: Probe | null;
  revisedExplanation: string;
  repair: RepairResult | null;
}

export type LearningEvent =
  | { type: "SOURCE_SELECTED"; source: LessonSource }
  | { type: "CHALLENGE_READY"; challenge: Challenge }
  | { type: "FIRST_EXPLANATION_CHANGED"; value: string }
  | { type: "DIAGNOSIS_READY"; diagnosis: Diagnosis; probe: Probe }
  | { type: "REVISED_EXPLANATION_CHANGED"; value: string }
  | { type: "REPAIR_READY"; repair: RepairResult }
  | { type: "BACK" }
  | { type: "RESET" };

export const LearningSessionSchema = z.object({
  version: z.literal(1),
  id: z.string().uuid(),
  stage: z.enum(["start", "teachback", "diagnosis", "repair", "result"]),
  source: LessonSourceSchema.nullable(),
  challenge: ChallengeSchema.nullable(),
  firstExplanation: z.string(),
  diagnosis: DiagnosisSchema.nullable(),
  probe: ProbeSchema.nullable(),
  revisedExplanation: z.string(),
  repair: RepairResultSchema.nullable(),
}).superRefine((session, context) => {
  const requiresChallenge = session.stage !== "start";
  const requiresDiagnosis = ["diagnosis", "repair", "result"].includes(session.stage);

  if (requiresChallenge && !session.source) {
    context.addIssue({
      code: "custom",
      path: ["source"],
      message: "This stage requires a source",
    });
  }

  if (requiresChallenge && !session.challenge) {
    context.addIssue({
      code: "custom",
      path: ["challenge"],
      message: "This stage requires a challenge",
    });
  }

  if (requiresDiagnosis && !session.diagnosis) {
    context.addIssue({
      code: "custom",
      path: ["diagnosis"],
      message: "This stage requires a diagnosis",
    });
  }

  if (requiresDiagnosis && !session.probe) {
    context.addIssue({
      code: "custom",
      path: ["probe"],
      message: "This stage requires a probe",
    });
  }

  if (session.stage === "result" && !session.repair) {
    context.addIssue({
      code: "custom",
      path: ["repair"],
      message: "The result stage requires repair data",
    });
  }
});

export function createLearningSession(id: string): LearningSession {
  return {
    version: 1,
    id,
    stage: "start",
    source: null,
    challenge: null,
    firstExplanation: "",
    diagnosis: null,
    probe: null,
    revisedExplanation: "",
    repair: null,
  };
}

export function learningSessionReducer(
  session: LearningSession,
  event: LearningEvent,
): LearningSession {
  switch (event.type) {
    case "SOURCE_SELECTED":
      return session.stage === "start" ? { ...session, source: event.source } : session;
    case "CHALLENGE_READY":
      return session.stage === "start" && session.source
        ? { ...session, challenge: event.challenge, stage: "teachback" }
        : session;
    case "FIRST_EXPLANATION_CHANGED":
      return session.stage === "teachback"
        ? { ...session, firstExplanation: event.value }
        : session;
    case "DIAGNOSIS_READY":
      return session.stage === "teachback" && session.source && session.challenge
        ? { ...session, diagnosis: event.diagnosis, probe: event.probe, stage: "diagnosis" }
        : session;
    case "REVISED_EXPLANATION_CHANGED":
      return session.stage === "diagnosis"
        ? { ...session, revisedExplanation: event.value, stage: "repair" }
        : session.stage === "repair"
          ? { ...session, revisedExplanation: event.value }
          : session;
    case "REPAIR_READY":
      return session.stage === "repair" && session.source && session.challenge && session.diagnosis && session.probe
        ? { ...session, repair: event.repair, stage: "result" }
        : session;
    case "BACK":
      return session.stage === "result"
        ? { ...session, stage: "repair" }
        : session.stage === "repair"
          ? { ...session, stage: "diagnosis" }
          : session.stage === "diagnosis"
            ? { ...session, stage: "teachback" }
            : session.stage === "teachback"
              ? { ...session, stage: "start" }
              : session;
    case "RESET":
      return createLearningSession(session.id);
  }
}

export function serializeSession(session: LearningSession): string {
  return JSON.stringify(session);
}

export function restoreSession(serialized: string): LearningSession | null {
  try {
    const parsed = LearningSessionSchema.safeParse(JSON.parse(serialized));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
