import "server-only";

import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import type { ResponseParseParams } from "openai/resources/responses/responses";
import { z } from "zod";
import {
  ModelUnavailableError,
  StructuredModelError,
} from "@/lib/ai/errors";
import {
  resolveAiProvider,
  type AiProviderConfig,
  type AiProviderId,
} from "@/lib/ai/provider";
import { ModelOutputValidationError } from "@/lib/domain/output-validation";

type StructuredResponse = {
  output_parsed: unknown;
  output?: unknown;
};

type StructuredParse = (
  request: ResponseParseParams,
) => Promise<StructuredResponse>;

export type StructuredCallOptions<T> = {
  schema: z.ZodType<T>;
  schemaName: string;
  instructions: string;
  input: string;
  safetyIdentifier: string;
  parse?: StructuredParse;
  validate?: (output: T) => void;
};

let client: OpenAI | undefined;
let clientProviderId: AiProviderId | undefined;

function getClient(provider: AiProviderConfig): OpenAI {
  if (client === undefined || clientProviderId !== provider.id) {
    client = new OpenAI({
      apiKey: provider.apiKey,
      baseURL: provider.baseURL,
      timeout: 25_000,
      maxRetries: 0,
    });
    clientProviderId = provider.id;
  }
  return client;
}

function hasModelRefusal(response: StructuredResponse): boolean {
  if (!Array.isArray(response.output)) {
    return false;
  }

  return response.output.some((item) => {
    if (!isRecord(item) || !Array.isArray(item.content)) {
      return false;
    }

    return item.content.some(
      (content) =>
        isRecord(content) &&
        content.type === "refusal" &&
        typeof content.refusal === "string",
    );
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function structuredRequest<T>(
  provider: AiProviderConfig,
  options: Pick<
    StructuredCallOptions<T>,
    "schema" | "schemaName" | "instructions" | "safetyIdentifier"
  > & { input: string },
): ResponseParseParams {
  const textFormat = zodTextFormat(options.schema, options.schemaName);
  const common = {
    model: provider.model,
    reasoning: { effort: "medium" as const },
    instructions: options.instructions,
    input: options.input,
  };

  if (provider.id === "mimo") {
    return {
      ...common,
      text: { format: textFormat },
    };
  }

  return {
    ...common,
    store: false,
    safety_identifier: options.safetyIdentifier,
    text: {
      format: textFormat,
      verbosity: "low",
    },
  };
}

function isUnavailableSdkError(error: unknown): boolean {
  if (
    error instanceof OpenAI.APIConnectionError ||
    error instanceof OpenAI.RateLimitError ||
    error instanceof OpenAI.InternalServerError
  ) {
    return true;
  }

  return (
    error instanceof OpenAI.APIError &&
    (error.status === 408 ||
      (error.status !== undefined && error.status >= 500))
  );
}

const SAFE_SCHEMA_PATH_SEGMENTS = new Set([
  "value",
  "lessonTitle",
  "concept",
  "prompt",
  "evidencePassages",
  "nodes",
  "priorityNodeId",
  "question",
  "evaluationTarget",
  "id",
  "claim",
  "status",
  "diagnosis",
  "evidence",
  "confidence",
  "previousStatus",
  "repairExplanation",
  "overallStatus",
  "before",
  "after",
  "recallCard",
]);

function safeIssuePath(path: PropertyKey[]): string {
  if (path.length === 0) {
    return "root";
  }

  return path
    .slice(0, 5)
    .map((segment) => {
      if (typeof segment === "number") {
        return `[${segment}]`;
      }
      return typeof segment === "string" &&
        SAFE_SCHEMA_PATH_SEGMENTS.has(segment)
        ? segment
        : "field";
    })
    .join(".");
}

function formatValidationFeedback(
  error: z.ZodError | ModelOutputValidationError,
): string {
  const detail =
    error instanceof z.ZodError
      ? error.issues
          .slice(0, 2)
          .map(
            (issue) =>
              `- schema path=${safeIssuePath(issue.path)} code=${issue.code}`,
          )
          .join("\n")
      : `- domain code=${error.feedbackCode}`;

  return [
    "<validation_feedback>",
    "The previous structured response failed validation.",
    detail,
    "Return a corrected structured response. Do not repeat or quote prior values.",
    "</validation_feedback>",
  ].join("\n");
}

export async function callStructured<T>({
  schema,
  schemaName,
  instructions,
  input,
  safetyIdentifier,
  parse,
  validate,
}: StructuredCallOptions<T>): Promise<T> {
  const provider = resolveAiProvider();
  if (provider === null) {
    throw new ModelUnavailableError();
  }
  const parseRequest: StructuredParse =
    parse ?? ((request) => getClient(provider).responses.parse(request));
  let lastError: unknown;
  let validationFeedback: string | undefined;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const request = structuredRequest(provider, {
      schema,
      schemaName,
      instructions,
      safetyIdentifier,
      input:
        validationFeedback === undefined
          ? input
          : `${input}\n\n${validationFeedback}`,
    });

    let response: StructuredResponse;
    try {
      response = await parseRequest(request);
    } catch (error) {
      if (!isUnavailableSdkError(error)) {
        throw error;
      }
      lastError = error;
      continue;
    }

    if (hasModelRefusal(response)) {
      throw new StructuredModelError("MODEL_REFUSED");
    }

    try {
      const parsed = schema.parse(response.output_parsed);
      validate?.(parsed);
      return parsed;
    } catch (error) {
      if (
        !(error instanceof z.ZodError) &&
        !(error instanceof ModelOutputValidationError)
      ) {
        throw error;
      }
      lastError = error;
      validationFeedback = formatValidationFeedback(error);
    }
  }

  if (isUnavailableSdkError(lastError)) {
    throw new ModelUnavailableError(lastError);
  }

  throw new StructuredModelError("MODEL_OUTPUT_INVALID", lastError);
}
