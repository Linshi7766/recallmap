import { describe, expect, it } from "vitest";
import {
  getAiProviderLabel,
  resolveAiProvider,
} from "@/lib/ai/provider";

describe("AI provider resolution", () => {
  it("selects GPT-5.6 when only the OpenAI key exists", () => {
    expect(
      resolveAiProvider({ OPENAI_API_KEY: "openai-secret" }),
    ).toEqual({
      id: "openai",
      label: "GPT-5.6",
      model: "gpt-5.6",
      apiKey: "openai-secret",
    });
  });

  it("selects mimo-v2.5 when only the MiMo key exists", () => {
    expect(resolveAiProvider({ MIMO_API_KEY: "mimo-secret" })).toEqual({
      id: "mimo",
      label: "MiMo V2.5",
      model: "mimo-v2.5",
      apiKey: "mimo-secret",
      baseURL: "https://api.xiaomimimo.com/v1",
    });
  });

  it("prefers GPT-5.6 when both keys exist", () => {
    expect(
      resolveAiProvider({
        OPENAI_API_KEY: "openai-secret",
        MIMO_API_KEY: "mimo-secret",
      })?.id,
    ).toBe("openai");
  });

  it("treats missing and whitespace-only keys as unconfigured", () => {
    expect(resolveAiProvider({})).toBeNull();
    expect(
      resolveAiProvider({ OPENAI_API_KEY: "  ", MIMO_API_KEY: "" }),
    ).toBeNull();
  });

  it("returns a public label without exposing either secret", () => {
    const env = {
      OPENAI_API_KEY: "openai-secret",
      MIMO_API_KEY: "mimo-secret",
    };
    const label = getAiProviderLabel(env);

    expect(label).toBe("GPT-5.6");
    expect(label).not.toContain(env.OPENAI_API_KEY);
    expect(label).not.toContain(env.MIMO_API_KEY);
    expect(getAiProviderLabel({ MIMO_API_KEY: "mimo-secret" })).toBe(
      "MiMo V2.5",
    );
    expect(getAiProviderLabel({})).toBe("Built-in demo fallback");
  });
});
