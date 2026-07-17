import {
  diagnoseExplanation,
  generateChallenge,
  generateChallengeProbe,
  verifyRepair,
} from "@/lib/ai/operations";
import { StructuredModelError } from "@/lib/ai/errors";
import {
  LearningRequestSchema,
  type Challenge,
  type Diagnosis,
  type LessonSource,
  type LearningRequest,
  type Probe,
  type ReasoningNode,
  type RepairResult,
} from "@/lib/domain/contracts";
import { getDemoFallback } from "@/lib/fixtures/demo-fallback";

type SessionInput = { source: LessonSource; sessionId: string };

export type LearningOperations = {
  generateChallenge: (input: SessionInput) => Promise<Challenge>;
  diagnoseExplanation: (input: SessionInput & {
    challenge: Challenge;
    firstExplanation: string;
  }) => Promise<Diagnosis>;
  generateChallengeProbe: (input: SessionInput & {
    firstExplanation: string;
    priorityNode: ReasoningNode | null;
  }) => Promise<Probe>;
  verifyRepair: (input: SessionInput & {
    firstExplanation: string;
    revisedExplanation: string;
    diagnosis: Diagnosis;
    probe: Probe;
  }) => Promise<RepairResult>;
};

const productionOperations: LearningOperations = {
  generateChallenge,
  diagnoseExplanation,
  generateChallengeProbe,
  verifyRepair,
};

type ErrorCode =
  | "INVALID_INPUT"
  | "MODEL_REFUSED"
  | "MODEL_UNAVAILABLE"
  | "INTERNAL_ERROR";

const errorMessages: Record<ErrorCode, string> = {
  INVALID_INPUT: "Request must be valid learning input.",
  MODEL_REFUSED: "The model cannot help with this request.",
  MODEL_UNAVAILABLE: "Learning service is temporarily unavailable.",
  INTERNAL_ERROR: "The learning service encountered an unexpected error.",
};

function success(data: unknown, fallback: boolean): Response {
  return Response.json({ ok: true, data, fallback });
}

function failure(code: ErrorCode, status: number): Response {
  return Response.json(
    { ok: false, error: { code, message: errorMessages[code] } },
    { status },
  );
}

function selectPriorityNode(diagnosis: Diagnosis): ReasoningNode | null {
  if (diagnosis.priorityNodeId === null) {
    return null;
  }
  return (
    diagnosis.nodes.find((node) => node.id === diagnosis.priorityNodeId) ?? null
  );
}

async function dispatch(
  request: LearningRequest,
  operations: LearningOperations,
): Promise<unknown> {
  switch (request.operation) {
    case "generate_challenge":
      return operations.generateChallenge({
        source: request.source,
        sessionId: request.sessionId,
      });
    case "diagnose": {
      const diagnosis = await operations.diagnoseExplanation({
        source: request.source,
        sessionId: request.sessionId,
        challenge: request.challenge,
        firstExplanation: request.firstExplanation,
      });
      const probe = await operations.generateChallengeProbe({
        source: request.source,
        sessionId: request.sessionId,
        firstExplanation: request.firstExplanation,
        priorityNode: selectPriorityNode(diagnosis),
      });
      return { diagnosis, probe };
    }
    case "verify":
      return operations.verifyRepair({
        source: request.source,
        sessionId: request.sessionId,
        firstExplanation: request.firstExplanation,
        revisedExplanation: request.revisedExplanation,
        diagnosis: request.diagnosis,
        probe: request.probe,
      });
  }
}

function mappedFailure(error: unknown): Response {
  if (error instanceof StructuredModelError) {
    if (error.code === "MODEL_REFUSED") {
      return failure("MODEL_REFUSED", 422);
    }
    if (error.code === "MODEL_UNAVAILABLE") {
      return failure("MODEL_UNAVAILABLE", 503);
    }
  }
  return failure("INTERNAL_ERROR", 500);
}

export function createLearnPost(
  operations: LearningOperations = productionOperations,
): (request: Request) => Promise<Response> {
  return async function post(request: Request): Promise<Response> {
    let parsed: LearningRequest;
    try {
      const body: unknown = await request.json();
      const result = LearningRequestSchema.safeParse(body);
      if (!result.success) {
        return failure("INVALID_INPUT", 400);
      }
      parsed = result.data;
    } catch {
      return failure("INVALID_INPUT", 400);
    }

    try {
      return success(await dispatch(parsed, operations), false);
    } catch (error) {
      if (
        error instanceof StructuredModelError &&
        error.code === "MODEL_REFUSED"
      ) {
        return mappedFailure(error);
      }

      const fallback = getDemoFallback(parsed);
      return fallback === null ? mappedFailure(error) : success(fallback, true);
    }
  };
}

export const POST = createLearnPost();
