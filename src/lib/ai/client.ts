import "server-only";

import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import type { ResponseParseParams } from "openai/resources/responses/responses";
import type { z } from "zod";
import {
  ModelUnavailableError,
  StructuredModelError,
} from "@/lib/ai/errors";

const MODEL = "gpt-5.6";

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

function getClient(): OpenAI {
  client ??= new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    timeout: 25_000,
    maxRetries: 0,
  });
  return client;
}

async function defaultParse(
  request: ResponseParseParams,
): Promise<StructuredResponse> {
  return getClient().responses.parse(request);
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

function isUnavailableSdkError(error: unknown): boolean {
  if (
    error instanceof OpenAI.APIConnectionError ||
    error instanceof OpenAI.RateLimitError ||
    error instanceof OpenAI.InternalServerError
  ) {
    return true;
  }

  return error instanceof OpenAI.APIError && error.status !== undefined && error.status >= 500;
}

function classifyModelError(error: unknown): StructuredModelError {
  if (error instanceof StructuredModelError) {
    return error;
  }

  if (isUnavailableSdkError(error)) {
    return new ModelUnavailableError(error);
  }

  return new StructuredModelError("MODEL_OUTPUT_INVALID", error);
}

export async function callStructured<T>({
  schema,
  schemaName,
  instructions,
  input,
  safetyIdentifier,
  parse = defaultParse,
  validate,
}: StructuredCallOptions<T>): Promise<T> {
  let lastError: unknown;
  const request: ResponseParseParams = {
    model: MODEL,
    reasoning: { effort: "medium" },
    store: false,
    safety_identifier: safetyIdentifier,
    instructions,
    input,
    text: {
      format: zodTextFormat(schema, schemaName),
      verbosity: "low",
    },
  };

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await parse(request);
      if (hasModelRefusal(response)) {
        throw new StructuredModelError("MODEL_REFUSED");
      }

      const parsed = schema.parse(response.output_parsed);
      validate?.(parsed);
      return parsed;
    } catch (error) {
      if (
        error instanceof StructuredModelError &&
        error.code === "MODEL_REFUSED"
      ) {
        throw error;
      }
      lastError = error;
    }
  }

  throw classifyModelError(lastError);
}
