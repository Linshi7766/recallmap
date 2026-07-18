import OpenAI from "openai";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  callStructured,
  getProviderTimeoutMs,
} from "@/lib/ai/client";
import {
  ModelUnavailableError,
  StructuredModelError,
} from "@/lib/ai/errors";
import { ModelOutputValidationError } from "@/lib/domain/output-validation";

const Output = z.object({ value: z.string() });

const options = {
  schema: Output,
  schemaName: "test",
  instructions: "Return a value.",
  input: "input",
  safetyIdentifier: "session",
};

const SENTINEL_INSTRUCTIONS = "instructions-sentinel";
const SENTINEL_INPUT = "input-sentinel";
const SENTINEL_RAW_OUTPUT = "raw-output-sentinel";

beforeEach(() => {
  vi.stubEnv("OPENAI_API_KEY", "test-openai-key");
  vi.stubEnv("MIMO_API_KEY", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

it("uses a longer request timeout only for MiMo", () => {
  expect(getProviderTimeoutMs("mimo")).toBe(45_000);
  expect(getProviderTimeoutMs("openai")).toBe(25_000);
});

it("returns parsed structured output with the required Responses payload", async () => {
  const parse = vi.fn().mockResolvedValue({ output_parsed: { value: "ok" } });

  await expect(callStructured({ ...options, parse })).resolves.toEqual({
    value: "ok",
  });
  expect(parse).toHaveBeenCalledTimes(1);
  expect(parse).toHaveBeenCalledWith(
    expect.objectContaining({
      model: "gpt-5.6",
      reasoning: { effort: "medium" },
      store: false,
      safety_identifier: "session",
      instructions: "Return a value.",
      input: "input",
      text: expect.objectContaining({ verbosity: "low" }),
    }),
  );
  expect(parse.mock.calls[0]?.[0].text.format).toMatchObject({
    type: "json_schema",
    name: "test",
    strict: true,
  });
});

it("retries exactly once after schema-invalid output", async () => {
  const parse = vi
    .fn()
    .mockResolvedValueOnce({ output_parsed: { value: 1 } })
    .mockResolvedValueOnce({ output_parsed: { value: "ok" } });

  await expect(callStructured({ ...options, parse })).resolves.toEqual({
    value: "ok",
  });
  expect(parse).toHaveBeenCalledTimes(2);
});

it("adds bounded schema feedback only to the second request", async () => {
  const parse = vi
    .fn()
    .mockResolvedValueOnce({
      output_parsed: { value: { injected: SENTINEL_RAW_OUTPUT } },
    })
    .mockResolvedValueOnce({ output_parsed: { value: "ok" } });

  await expect(
    callStructured({
      ...options,
      input: SENTINEL_INPUT,
      parse,
    }),
  ).resolves.toEqual({ value: "ok" });

  const firstRequest = parse.mock.calls[0]?.[0];
  const secondRequest = parse.mock.calls[1]?.[0];
  expect(firstRequest?.input).toBe(SENTINEL_INPUT);
  expect(firstRequest?.instructions).toBe(options.instructions);
  expect(secondRequest?.instructions).toBe(options.instructions);
  expect(secondRequest?.input).toBe(
    `${SENTINEL_INPUT}\n\n<validation_feedback>\n` +
      "The previous structured response failed validation.\n" +
      "- schema path=value code=invalid_type\n" +
      "Return a corrected structured response. Do not repeat or quote prior values.\n" +
      "</validation_feedback>",
  );
  const feedback = String(secondRequest?.input).slice(SENTINEL_INPUT.length);
  expect(feedback.length).toBeLessThanOrEqual(512);
  expect(feedback).not.toContain(SENTINEL_RAW_OUTPUT);
});

it("bounds feedback even when several validation paths are deeply nested", async () => {
  const DeepOutput = z.object({
    repairExplanation: z.object({
      repairExplanation: z.object({
        repairExplanation: z.object({
          repairExplanation: z.object({
            repairExplanation: z.object({
              value: z.string(),
              evidencePassages: z.string(),
              evaluationTarget: z.string(),
            }),
          }),
        }),
      }),
    }),
  });
  const invalid = {
    repairExplanation: {
      repairExplanation: {
        repairExplanation: {
          repairExplanation: {
            repairExplanation: {
              value: 1,
              evidencePassages: 2,
              evaluationTarget: 3,
            },
          },
        },
      },
    },
  };
  const valid = {
    repairExplanation: {
      repairExplanation: {
        repairExplanation: {
          repairExplanation: {
            repairExplanation: {
              value: "ok",
              evidencePassages: "ok",
              evaluationTarget: "ok",
            },
          },
        },
      },
    },
  };
  const parse = vi
    .fn()
    .mockResolvedValueOnce({ output_parsed: invalid })
    .mockResolvedValueOnce({ output_parsed: valid });

  await callStructured({
    ...options,
    schema: DeepOutput,
    schemaName: "deep_test",
    parse,
  });

  const feedback = String(parse.mock.calls[1]?.[0].input).slice(
    options.input.length,
  );
  expect(feedback.length).toBeLessThanOrEqual(512);
  expect(feedback).toMatch(/<\/validation_feedback>$/);
});

it("retries once when output parsing returns null", async () => {
  const parse = vi
    .fn()
    .mockResolvedValueOnce({ output_parsed: null })
    .mockResolvedValueOnce({ output_parsed: { value: "ok" } });

  await expect(callStructured({ ...options, parse })).resolves.toEqual({
    value: "ok",
  });
  expect(parse).toHaveBeenCalledTimes(2);
});

it("retries once when trusted domain validation rejects parsed output", async () => {
  const validate = vi
    .fn<(output: z.infer<typeof Output>) => void>()
    .mockImplementationOnce(() => {
      throw new ModelOutputValidationError(
        "repair_invariant_failed",
        "business validation failed",
      );
    });
  const parse = vi
    .fn()
    .mockResolvedValue({ output_parsed: { value: "ok" } });

  await expect(callStructured({ ...options, parse, validate })).resolves.toEqual({
    value: "ok",
  });
  expect(parse).toHaveBeenCalledTimes(2);
  expect(validate).toHaveBeenCalledTimes(2);
});

it("uses fixed domain feedback without reflecting a validation error message", async () => {
  const validate = vi
    .fn<(output: z.infer<typeof Output>) => void>()
    .mockImplementationOnce(() => {
      throw new ModelOutputValidationError(
        "evidence_not_grounded",
        `business validation failed: ${SENTINEL_RAW_OUTPUT}`,
      );
    });
  const parse = vi
    .fn()
    .mockResolvedValue({ output_parsed: { value: "ok" } });

  await expect(
    callStructured({ ...options, input: SENTINEL_INPUT, parse, validate }),
  ).resolves.toEqual({ value: "ok" });

  expect(parse).toHaveBeenCalledTimes(2);
  const feedback = String(parse.mock.calls[1]?.[0].input).slice(
    SENTINEL_INPUT.length,
  );
  expect(feedback).toBe(
      "\n\n<validation_feedback>\n" +
      "The previous structured response failed validation.\n" +
      "- domain code=evidence_not_grounded\n" +
      "Return a corrected structured response. Do not repeat or quote prior values.\n" +
      "</validation_feedback>",
  );
  expect(feedback.length).toBeLessThanOrEqual(512);
  expect(feedback).not.toContain(SENTINEL_RAW_OUTPUT);
});

it("does not retry or reclassify an unexpected validator error", async () => {
  const error = new Error(`unexpected validator bug: ${SENTINEL_RAW_OUTPUT}`);
  const validate = vi.fn(() => {
    throw error;
  });
  const parse = vi
    .fn()
    .mockResolvedValue({ output_parsed: { value: "ok" } });

  await expect(
    callStructured({ ...options, parse, validate }),
  ).rejects.toBe(error);
  expect(parse).toHaveBeenCalledTimes(1);
  expect(validate).toHaveBeenCalledTimes(1);
});

it("preserves a model refusal without retrying it", async () => {
  const parse = vi.fn().mockResolvedValue({
    output_parsed: null,
    output: [
      {
        type: "message",
        content: [{ type: "refusal", refusal: "Cannot comply" }],
      },
    ],
  });

  await expect(callStructured({ ...options, parse })).rejects.toMatchObject({
    code: "MODEL_REFUSED",
  } satisfies Partial<StructuredModelError>);
  expect(parse).toHaveBeenCalledTimes(1);
});

it.each([
  ["rate limits", new OpenAI.RateLimitError(429, {}, "rate limited", new Headers())],
  ["timeouts", new OpenAI.APIConnectionTimeoutError()],
  ["HTTP timeouts", new OpenAI.APIError(408, {}, "request timeout", new Headers())],
  ["server errors", new OpenAI.InternalServerError(500, {}, "server", new Headers())],
])("maps SDK %s to MODEL_UNAVAILABLE", async (_name, error) => {
  const parse = vi.fn().mockRejectedValue(error);

  await expect(callStructured({ ...options, parse })).rejects.toBeInstanceOf(
    ModelUnavailableError,
  );
  expect(parse).toHaveBeenCalledTimes(2);
});

it.each([
  ["rate limits", new OpenAI.RateLimitError(429, {}, "rate limited", new Headers())],
  ["timeouts", new OpenAI.APIConnectionTimeoutError()],
  ["HTTP timeouts", new OpenAI.APIError(408, {}, "request timeout", new Headers())],
  ["server errors", new OpenAI.InternalServerError(500, {}, "server", new Headers())],
])("does not automatically retry MiMo SDK %s", async (_name, error) => {
  vi.stubEnv("OPENAI_API_KEY", "");
  vi.stubEnv("MIMO_API_KEY", "test-mimo-key");
  const create = vi.fn().mockRejectedValue(error);

  await expect(
    callStructured({ ...options, create }),
  ).rejects.toBeInstanceOf(ModelUnavailableError);
  expect(create).toHaveBeenCalledTimes(1);
});

it.each([
  [
    "authentication failures",
    new OpenAI.AuthenticationError(401, {}, "invalid key", new Headers()),
  ],
  [
    "bad requests",
    new OpenAI.BadRequestError(400, {}, "invalid request", new Headers()),
  ],
  ["unexpected parse failures", new Error("unexpected parser bug")],
])("does not retry or reclassify %s", async (_name, error) => {
  const parse = vi.fn().mockRejectedValue(error);

  await expect(callStructured({ ...options, parse })).rejects.toBe(error);
  expect(parse).toHaveBeenCalledTimes(1);
});

it("returns MODEL_OUTPUT_INVALID after two invalid outputs", async () => {
  const parse = vi.fn().mockResolvedValue({ output_parsed: { value: 1 } });

  await expect(callStructured({ ...options, parse })).rejects.toMatchObject({
    code: "MODEL_OUTPUT_INVALID",
  } satisfies Partial<StructuredModelError>);
  expect(parse).toHaveBeenCalledTimes(2);
});

it("returns MODEL_OUTPUT_INVALID after validation fails twice", async () => {
  const parse = vi.fn().mockResolvedValue({ output_parsed: { value: "ok" } });
  const validate = () => {
    throw new ModelOutputValidationError(
      "repair_invariant_failed",
      "business validation failed",
    );
  };

  await expect(callStructured({ ...options, parse, validate })).rejects.toMatchObject({
    code: "MODEL_OUTPUT_INVALID",
  } satisfies Partial<StructuredModelError>);
  expect(parse).toHaveBeenCalledTimes(2);
});

it("redacts two invalid outputs while retaining the final validation failure", async () => {
  const finalOutput = { value: { secret: SENTINEL_RAW_OUTPUT } };
  const expectedFinalFailure = Output.safeParse(finalOutput);
  if (expectedFinalFailure.success) {
    throw new Error("Expected the final output to fail schema validation");
  }
  const parse = vi
    .fn()
    .mockResolvedValueOnce({ output_parsed: { value: 1 } })
    .mockResolvedValueOnce({ output_parsed: finalOutput });

  const error = await callStructured({
    ...options,
    instructions: SENTINEL_INSTRUCTIONS,
    input: SENTINEL_INPUT,
    parse,
  }).catch((reason: unknown) => reason);

  expect(error).toMatchObject({
    code: "MODEL_OUTPUT_INVALID",
    message: "MODEL_OUTPUT_INVALID",
  } satisfies Partial<StructuredModelError>);
  expect((error as StructuredModelError).cause).toBeInstanceOf(z.ZodError);
  expect(((error as StructuredModelError).cause as z.ZodError).issues).toEqual(
    expectedFinalFailure.error.issues,
  );
  expect((error as StructuredModelError).message).not.toContain(
    SENTINEL_INSTRUCTIONS,
  );
  expect((error as StructuredModelError).message).not.toContain(SENTINEL_INPUT);
  expect((error as StructuredModelError).message).not.toContain(
    SENTINEL_RAW_OUTPUT,
  );
  expect(parse).toHaveBeenCalledTimes(2);
});

it("redacts an unavailable SDK failure while retaining the final cause", async () => {
  const finalError = new OpenAI.RateLimitError(
    429,
    {},
    SENTINEL_RAW_OUTPUT,
    new Headers(),
  );
  const parse = vi
    .fn()
    .mockRejectedValueOnce(new OpenAI.APIConnectionTimeoutError())
    .mockRejectedValueOnce(finalError);

  const error = await callStructured({
    ...options,
    instructions: SENTINEL_INSTRUCTIONS,
    input: SENTINEL_INPUT,
    parse,
  }).catch((reason: unknown) => reason);

  expect(error).toMatchObject({
    code: "MODEL_UNAVAILABLE",
    message: "MODEL_UNAVAILABLE",
  } satisfies Partial<ModelUnavailableError>);
  expect((error as ModelUnavailableError).cause).toBe(finalError);
  expect((error as ModelUnavailableError).message).not.toContain(
    SENTINEL_INSTRUCTIONS,
  );
  expect((error as ModelUnavailableError).message).not.toContain(SENTINEL_INPUT);
  expect((error as ModelUnavailableError).message).not.toContain(
    SENTINEL_RAW_OUTPUT,
  );
  expect(parse).toHaveBeenCalledTimes(2);
});

it("uses bounded low reasoning for MiMo JSON object output", async () => {
  vi.stubEnv("OPENAI_API_KEY", "");
  vi.stubEnv("MIMO_API_KEY", "test-mimo-key");
  const create = vi.fn().mockResolvedValue({
    output_text: JSON.stringify({ value: "ok" }),
  });
  const parse = vi.fn(() => {
    throw new Error("MiMo must not use responses.parse");
  });
  const validate = vi.fn();

  await expect(
    callStructured({ ...options, create, parse, validate }),
  ).resolves.toEqual({ value: "ok" });

  expect(parse).not.toHaveBeenCalled();
  expect(create).toHaveBeenCalledTimes(1);
  expect(validate).toHaveBeenCalledWith({ value: "ok" });
  const request = create.mock.calls[0]?.[0];
  const expectedJsonSchema = JSON.stringify(z.toJSONSchema(Output));
  expect(request).toMatchObject({
    model: "mimo-v2.5",
    reasoning: { effort: "low" },
    max_output_tokens: 4_096,
    instructions: expect.any(String),
    input: options.input,
    text: { format: { type: "json_object" } },
  });
  expect(request.instructions).toBe(
    [
      options.instructions,
      "Return exactly one JSON object and no surrounding text.",
      "The JSON object must match this exact JSON Schema:",
      expectedJsonSchema,
    ].join("\n\n"),
  );
  expect(request.instructions).not.toContain(options.input);
  expect(request).not.toHaveProperty("store");
  expect(request).not.toHaveProperty("safety_identifier");
  expect(request.text).not.toHaveProperty("verbosity");
  expect(request.text.format).not.toHaveProperty("name");
  expect(request.text.format).not.toHaveProperty("schema");
  expect(request.text.format).not.toHaveProperty("strict");
});

it("retries malformed MiMo JSON once without reflecting raw output", async () => {
  vi.stubEnv("OPENAI_API_KEY", "");
  vi.stubEnv("MIMO_API_KEY", "test-mimo-key");
  const create = vi
    .fn()
    .mockResolvedValueOnce({ output_text: SENTINEL_RAW_OUTPUT })
    .mockResolvedValueOnce({ output_text: JSON.stringify({ value: "ok" }) });
  const parse = vi.fn(() => {
    throw new Error("MiMo must not use responses.parse");
  });

  await expect(
    callStructured({ ...options, input: SENTINEL_INPUT, create, parse }),
  ).resolves.toEqual({ value: "ok" });

  expect(parse).not.toHaveBeenCalled();
  expect(create).toHaveBeenCalledTimes(2);
  const secondInput = String(create.mock.calls[1]?.[0].input);
  expect(secondInput).toBe(
    `${SENTINEL_INPUT}\n\n<validation_feedback>\n` +
      "The previous structured response failed validation.\n" +
      "- format code=invalid_json\n" +
      "Return a corrected structured response. Do not repeat or quote prior values.\n" +
      "</validation_feedback>",
  );
  expect(secondInput).not.toContain(SENTINEL_RAW_OUTPUT);
});

it("redacts malformed MiMo JSON after the bounded retry", async () => {
  vi.stubEnv("OPENAI_API_KEY", "");
  vi.stubEnv("MIMO_API_KEY", "test-mimo-key");
  const create = vi.fn().mockResolvedValue({
    output_text: SENTINEL_RAW_OUTPUT,
  });
  const parse = vi.fn(() => {
    throw new Error("MiMo must not use responses.parse");
  });

  const error = await callStructured({
    ...options,
    instructions: SENTINEL_INSTRUCTIONS,
    input: SENTINEL_INPUT,
    create,
    parse,
  }).catch((reason: unknown) => reason);

  expect(error).toMatchObject({
    code: "MODEL_OUTPUT_INVALID",
    message: "MODEL_OUTPUT_INVALID",
    cause: {
      name: "MalformedJsonError",
      message: "Invalid JSON model output",
    },
  } satisfies Partial<StructuredModelError>);
  expect(create).toHaveBeenCalledTimes(2);
  const publicFailure = `${String(error)} ${String(
    (error as StructuredModelError).cause,
  )} ${String(create.mock.calls[1]?.[0].input)}`;
  expect(publicFailure).not.toContain(SENTINEL_INSTRUCTIONS);
  expect(publicFailure).not.toContain(SENTINEL_RAW_OUTPUT);
});

it("returns MODEL_UNAVAILABLE before parsing when neither key exists", async () => {
  vi.stubEnv("OPENAI_API_KEY", "");
  vi.stubEnv("MIMO_API_KEY", "");
  const parse = vi.fn();

  await expect(callStructured({ ...options, parse })).rejects.toBeInstanceOf(
    ModelUnavailableError,
  );
  expect(parse).not.toHaveBeenCalled();
});
