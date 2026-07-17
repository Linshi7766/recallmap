import OpenAI from "openai";
import { expect, it, vi } from "vitest";
import { z } from "zod";
import { callStructured } from "@/lib/ai/client";
import {
  ModelUnavailableError,
  StructuredModelError,
} from "@/lib/ai/errors";

const Output = z.object({ value: z.string() });

const options = {
  schema: Output,
  schemaName: "test",
  instructions: "Return a value.",
  input: "input",
  safetyIdentifier: "session",
};

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

it("retries once when validation rejects parsed output", async () => {
  const validate = vi
    .fn<(output: z.infer<typeof Output>) => void>()
    .mockImplementationOnce(() => {
      throw new Error("business validation failed");
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
  ["server errors", new OpenAI.InternalServerError(500, {}, "server", new Headers())],
])("maps SDK %s to MODEL_UNAVAILABLE", async (_name, error) => {
  const parse = vi.fn().mockRejectedValue(error);

  await expect(callStructured({ ...options, parse })).rejects.toBeInstanceOf(
    ModelUnavailableError,
  );
  expect(parse).toHaveBeenCalledTimes(2);
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
    throw new Error("business validation failed");
  };

  await expect(callStructured({ ...options, parse, validate })).rejects.toMatchObject({
    code: "MODEL_OUTPUT_INVALID",
  } satisfies Partial<StructuredModelError>);
  expect(parse).toHaveBeenCalledTimes(2);
});
