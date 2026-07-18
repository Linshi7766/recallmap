import "server-only";

export type AiProviderId = "openai" | "mimo";

export type AiProviderConfig = {
  id: AiProviderId;
  label: "GPT-5.6" | "MiMo V2.5";
  model: "gpt-5.6" | "mimo-v2.5";
  apiKey: string;
  baseURL?: string;
};

type ProviderEnvironment = Partial<
  Pick<NodeJS.ProcessEnv, "OPENAI_API_KEY" | "MIMO_API_KEY">
> & { [key: string]: string | undefined };

function configured(value: string | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function resolveAiProvider(
  env: ProviderEnvironment = process.env,
): AiProviderConfig | null {
  if (configured(env.OPENAI_API_KEY)) {
    return {
      id: "openai",
      label: "GPT-5.6",
      model: "gpt-5.6",
      apiKey: env.OPENAI_API_KEY,
    };
  }

  if (configured(env.MIMO_API_KEY)) {
    return {
      id: "mimo",
      label: "MiMo V2.5",
      model: "mimo-v2.5",
      apiKey: env.MIMO_API_KEY,
      baseURL: "https://api.xiaomimimo.com/v1",
    };
  }

  return null;
}

export function getAiProviderLabel(
  env: ProviderEnvironment = process.env,
): "GPT-5.6" | "MiMo V2.5" | "Built-in demo fallback" {
  return resolveAiProvider(env)?.label ?? "Built-in demo fallback";
}
