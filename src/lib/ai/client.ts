import "server-only";

import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import type {
  ResponseCreateParamsNonStreaming,
  ResponseParseParams,
} from "openai/resources/responses/responses";
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

type RawStructuredResponse = {
  output_text: string;
  output?: unknown;
};

type StructuredParse = (
  request: ResponseParseParams,
) => Promise<StructuredResponse>;

type StructuredCreate = (
  request: ResponseCreateParamsNonStreaming,
) => Promise<RawStructuredResponse>;

export type StructuredCallOptions<T> = {
  schema: z.ZodType<T>;
  schemaName: string;
  instructions: string;
  input: string;
  safetyIdentifier: string;
  parse?: StructuredParse;
  create?: StructuredCreate;
  validate?: (output: T) => void;
};

let client: OpenAI | undefined;
let clientProviderId: AiProviderId | undefined;

export function getProviderTimeoutMs(
  providerId: AiProviderId,
): 25_000 | 45_000 {
  return providerId === "mimo" ? 45_000 : 25_000;
}

function getClient(provider: AiProviderConfig): OpenAI {
  if (client === undefined || clientProviderId !== provider.id) {
    client = new OpenAI({
      apiKey: provider.apiKey,
      baseURL: provider.baseURL,
      timeout: getProviderTimeoutMs(provider.id),
      maxRetries: 0,
    });
    clientProviderId = provider.id;
  }
  return client;
}

function hasModelRefusal(response: { output?: unknown }): boolean {
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

function openAiStructuredRequest<T>(
  provider: AiProviderConfig,
  options: Pick<
    StructuredCallOptions<T>,
    "schema" | "schemaName" | "instructions" | "safetyIdentifier"
  > & { input: string },
): ResponseParseParams {
  const textFormat = zodTextFormat(options.schema, options.schemaName);
  return {
    model: provider.model,
    reasoning: { effort: "medium" as const },
    store: false,
    safety_identifier: options.safetyIdentifier,
    instructions: options.instructions,
    input: options.input,
    text: {
      format: textFormat,
      verbosity: "low",
    },
  };
}

function mimoStructuredRequest<T>(
  provider: AiProviderConfig,
  options: Pick<
    StructuredCallOptions<T>,
    "schema" | "instructions"
  > & { input: string },
): ResponseCreateParamsNonStreaming {
  const jsonSchema = JSON.stringify(z.toJSONSchema(options.schema));

  return {
    model: provider.model,
    reasoning: { effort: "medium" },
    instructions: [
      options.instructions,
      "Return exactly one JSON object and no surrounding text.",
      "The JSON object must match this exact JSON Schema:",
      jsonSchema,
    ].join("\n\n"),
    input: options.input,
    text: { format: { type: "json_object" } },
  };
}

class MalformedJsonError extends Error {
  constructor() {
    super("Invalid JSON model output");
    this.name = "MalformedJsonError";
  }
}

function parseMimoOutput(outputText: string): unknown {
  try {
    return JSON.parse(outputText);
  } catch {
    throw new MalformedJsonError();
  }
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
  error: z.ZodError | ModelOutputValidationError | MalformedJsonError,
): string {
  const detail =
    error instanceof MalformedJsonError
      ? "- format code=invalid_json"
      : error instanceof z.ZodError
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
  create,
  validate,
}: StructuredCallOptions<T>): Promise<T> {
  const provider = resolveAiProvider();
  if (provider === null) {
    throw new ModelUnavailableError();
  }
  const parseRequest: StructuredParse =
    parse ?? ((request) => getClient(provider).responses.parse(request));
  const createRequest: StructuredCreate =
    create ??
    (async (request) => getClient(provider).responses.create(request));
  let lastError: unknown;
  let validationFeedback: string | undefined;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const requestInput =
      validationFeedback === undefined
        ? input
        : `${input}\n\n${validationFeedback}`;

    let response: StructuredResponse;
    try {
      if (provider.id === "mimo") {
        const rawResponse = await createRequest(
          mimoStructuredRequest(provider, {
            schema,
            instructions,
            input: requestInput,
          }),
        );
        response = {
          output_parsed: hasModelRefusal(rawResponse)
            ? null
            : parseMimoOutput(rawResponse.output_text),
          output: rawResponse.output,
        };
      } else {
        response = await parseRequest(
          openAiStructuredRequest(provider, {
            schema,
            schemaName,
            instructions,
            safetyIdentifier,
            input: requestInput,
          }),
        );
      }
    } catch (error) {
      if (error instanceof MalformedJsonError) {
        lastError = error;
        validationFeedback = formatValidationFeedback(error);
        continue;
      }
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
        !(error instanceof ModelOutputValidationError) &&
        !(error instanceof MalformedJsonError)
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
