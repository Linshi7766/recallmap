import { z } from "zod";
import {
  ChallengeSchema,
  DiagnosisSchema,
  ProbeSchema,
  RepairResultSchema,
  type Challenge,
  type Diagnosis,
  type LessonSource,
  type Probe,
  type RepairResult,
} from "@/lib/domain/contracts";
import { assertRepairMatchesDiagnosis } from "@/lib/domain/repair";

const DiagnosisResultSchema = z
  .object({
    diagnosis: DiagnosisSchema,
    probe: ProbeSchema,
  })
  .strict();

const FailureEnvelopeSchema = z
  .object({
    ok: z.literal(false),
    error: z
      .object({
        code: z.enum([
          "INVALID_INPUT",
          "MODEL_REFUSED",
          "MODEL_UNAVAILABLE",
          "INTERNAL_ERROR",
        ]),
        message: z.string(),
      })
      .strict(),
  })
  .strict();

export type LearningApiErrorCode =
  | "INVALID_INPUT"
  | "MODEL_REFUSED"
  | "MODEL_UNAVAILABLE"
  | "INTERNAL_ERROR"
  | "INVALID_RESPONSE"
  | "NETWORK_ERROR";

const ERROR_MESSAGES: Record<LearningApiErrorCode, string> = {
  INVALID_INPUT: "Recall could not accept that learning input.",
  MODEL_REFUSED: "Recall cannot analyze this material.",
  MODEL_UNAVAILABLE: "Recall is temporarily unavailable. Please try again.",
  INTERNAL_ERROR: "Recall encountered an unexpected error. Please try again.",
  INVALID_RESPONSE: "Recall could not validate the learning service response.",
  NETWORK_ERROR: "Recall could not reach the learning service. Please try again.",
};

export class LearningApiError extends Error {
  readonly code: LearningApiErrorCode;

  constructor(code: LearningApiErrorCode) {
    super(ERROR_MESSAGES[code]);
    this.name = "LearningApiError";
    this.code = code;
  }
}

async function postLearning<T>(
  body: object,
  dataSchema: z.ZodType<T>,
): Promise<T> {
  let response: Response;
  let payload: unknown;

  try {
    response = await fetch("/api/learn", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new LearningApiError("NETWORK_ERROR");
  }

  try {
    payload = await response.json();
  } catch {
    throw new LearningApiError("INVALID_RESPONSE");
  }

  const failure = FailureEnvelopeSchema.safeParse(payload);
  if (!response.ok) {
    throw new LearningApiError(
      failure.success ? failure.data.error.code : "INVALID_RESPONSE",
    );
  }

  const successEnvelope = z
    .object({
      ok: z.literal(true),
      data: dataSchema,
      fallback: z.boolean(),
    })
    .strict()
    .safeParse(payload);

  if (!successEnvelope.success) {
    throw new LearningApiError("INVALID_RESPONSE");
  }

  return successEnvelope.data.data;
}

export function requestChallenge(
  sessionId: string,
  source: LessonSource,
): Promise<Challenge> {
  return postLearning(
    { operation: "generate_challenge", sessionId, source },
    ChallengeSchema,
  );
}

export function requestDiagnosis(
  sessionId: string,
  source: LessonSource,
  challenge: Challenge,
  firstExplanation: string,
): Promise<{ diagnosis: Diagnosis; probe: Probe }> {
  return postLearning(
    {
      operation: "diagnose",
      sessionId,
      source,
      challenge,
      firstExplanation,
    },
    DiagnosisResultSchema,
  );
}

export async function requestRepair(
  sessionId: string,
  source: LessonSource,
  challenge: Challenge,
  firstExplanation: string,
  diagnosis: Diagnosis,
  probe: Probe,
  revisedExplanation: string,
): Promise<RepairResult> {
  void challenge;
  const repair = await postLearning(
    {
      operation: "verify",
      sessionId,
      source,
      firstExplanation,
      diagnosis,
      probe,
      revisedExplanation,
    },
    RepairResultSchema,
  );

  try {
    assertRepairMatchesDiagnosis(diagnosis, repair);
  } catch {
    throw new LearningApiError("INVALID_RESPONSE");
  }

  return repair;
}
