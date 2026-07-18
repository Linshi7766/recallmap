# Recall MiMo V2.5 Provider Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Xiaomi `mimo-v2.5` as a truthful production provider when no OpenAI API key exists, while preserving GPT-5.6 as the preferred provider and the exact demo fallback as the final path.

**Architecture:** A pure server-only provider module resolves environment configuration and public labels. The existing structured-call boundary builds provider-specific Responses API requests and caches the matching OpenAI SDK client; the route and learning-domain contracts remain unchanged. The server page passes a non-secret provider label into the client UI.

**Tech Stack:** Next.js 16 App Router, TypeScript 6, OpenAI Node SDK 6, Responses API, Zod 4, Vitest 4, Testing Library, Playwright.

## Global Constraints

- OpenAI wins when both `OPENAI_API_KEY` and `MIMO_API_KEY` are configured.
- Xiaomi uses model ID `mimo-v2.5` and base URL `https://api.xiaomimimo.com/v1`.
- No API key value may enter Git, rendered UI, API envelopes, logs, screenshots, progress files, or chat.
- Preserve GPT-5.6 request behavior: medium reasoning, `store: false`, `safety_identifier`, strict Zod format, and low verbosity.
- MiMo requests include only model, instructions, input, reasoning, and strict structured text format.
- Missing credentials produce `MODEL_UNAVAILABLE`; authentication and bad-request failures remain non-fallback errors.
- The API success envelope remains `{ ok, data, fallback }`.
- Automated tests make no live model calls.
- Node.js remains `>=20.19.0`; no dependency upgrade is in scope.

---

## File structure

- Create `src/lib/ai/provider.ts`: resolve provider credentials, model/base URL, and safe public label.
- Create `tests/ai/provider.test.ts`: provider priority, missing configuration, and secret-safe label tests.
- Modify `src/lib/ai/client.ts`: select provider, construct provider-specific request, and create the matching SDK client.
- Modify `tests/ai/client.test.ts`: preserve OpenAI behavior; add MiMo request and missing-key coverage.
- Modify `src/app/page.tsx`: resolve the public provider label on the server.
- Modify `src/components/recall/recall-app.tsx`: render the label without changing the learning state machine.
- Modify `src/app/globals.css`: style the provider disclosure.
- Modify `tests/components/recall-app.test.tsx`: verify the public label.
- Modify `.env.example`: document both blank credential variables.
- Modify `README.md`: explain selection priority, MiMo limitations, and truthful competition disclosure.
- Modify `task_plan.md`, `findings.md`, and `progress.md`: record verified implementation and remaining server deployment step.

---

### Task 1: Pure provider resolution

**Files:**
- Create: `src/lib/ai/provider.ts`
- Create: `tests/ai/provider.test.ts`

**Interfaces:**
- Produces: `AiProviderId`, `AiProviderConfig`, `resolveAiProvider(env)`, and `getAiProviderLabel(env)`.
- `resolveAiProvider` returns a credential-bearing object only inside the server boundary; `getAiProviderLabel` returns only public copy.

- [ ] **Step 1: Write the failing provider tests**

Create `tests/ai/provider.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the provider test and verify RED**

Run:

```powershell
npm test -- tests/ai/provider.test.ts
```

Expected: FAIL because `@/lib/ai/provider` does not exist.

- [ ] **Step 3: Implement the minimal provider module**

Create `src/lib/ai/provider.ts`:

```ts
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
>;

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
```

- [ ] **Step 4: Run the provider tests and verify GREEN**

Run:

```powershell
npm test -- tests/ai/provider.test.ts
```

Expected: 5 tests pass with no warnings.

- [ ] **Step 5: Commit the provider boundary**

```powershell
git add -- src/lib/ai/provider.ts tests/ai/provider.test.ts
git commit -m "feat: resolve OpenAI and MiMo providers"
```

---

### Task 2: Provider-specific Responses requests

**Files:**
- Modify: `src/lib/ai/client.ts`
- Modify: `tests/ai/client.test.ts`

**Interfaces:**
- Consumes: `resolveAiProvider(): AiProviderConfig | null` from Task 1.
- Preserves: `callStructured<T>(options): Promise<T>` for every operation caller.
- Produces no new route or browser contract.

- [ ] **Step 1: Make existing client tests explicitly configure OpenAI**

In `tests/ai/client.test.ts`, change the Vitest import and add environment cleanup:

```ts
import { afterEach, beforeEach, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.stubEnv("OPENAI_API_KEY", "test-openai-key");
  vi.stubEnv("MIMO_API_KEY", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
});
```

Keep all existing tests unchanged after this setup.

- [ ] **Step 2: Add failing MiMo and missing-key tests**

Append to `tests/ai/client.test.ts`:

```ts
it("uses the reduced MiMo Responses payload when only MIMO_API_KEY exists", async () => {
  vi.stubEnv("OPENAI_API_KEY", "");
  vi.stubEnv("MIMO_API_KEY", "test-mimo-key");
  const parse = vi.fn().mockResolvedValue({ output_parsed: { value: "ok" } });

  await expect(callStructured({ ...options, parse })).resolves.toEqual({
    value: "ok",
  });

  const request = parse.mock.calls[0]?.[0];
  expect(request).toMatchObject({
    model: "mimo-v2.5",
    reasoning: { effort: "medium" },
    instructions: options.instructions,
    input: options.input,
    text: {
      format: expect.objectContaining({
        type: "json_schema",
        name: "test",
        strict: true,
      }),
    },
  });
  expect(request).not.toHaveProperty("store");
  expect(request).not.toHaveProperty("safety_identifier");
  expect(request.text).not.toHaveProperty("verbosity");
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
```

- [ ] **Step 3: Run client tests and verify RED**

Run:

```powershell
npm test -- tests/ai/client.test.ts
```

Expected: the MiMo test receives the old `gpt-5.6` payload and the missing-key test does not produce the required typed failure.

- [ ] **Step 4: Implement provider-aware client creation and requests**

In `src/lib/ai/client.ts`:

1. Import the provider types and resolver:

```ts
import {
  resolveAiProvider,
  type AiProviderConfig,
  type AiProviderId,
} from "@/lib/ai/provider";
```

2. Delete `const MODEL = "gpt-5.6";` and replace the singleton with:

```ts
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
```

3. Delete `defaultParse`. Add a focused request builder after `isRecord`:

```ts
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
```

4. Remove `parse = defaultParse` from the `callStructured` destructuring. Resolve the provider once before the retry loop:

```ts
  const provider = resolveAiProvider();
  if (provider === null) {
    throw new ModelUnavailableError();
  }
  const parseRequest: StructuredParse =
    parse ?? ((request) => getClient(provider).responses.parse(request));
```

5. Replace the inline `request` object with:

```ts
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
```

6. Replace `response = await parse(request);` with:

```ts
      response = await parseRequest(request);
```

- [ ] **Step 5: Run focused client and route tests**

Run:

```powershell
npm test -- tests/ai/client.test.ts tests/api/learn-route.test.ts
```

Expected: all focused tests pass; the existing fallback, refusal, error-redaction, and retry tests remain green.

- [ ] **Step 6: Commit the runtime adapter**

```powershell
git add -- src/lib/ai/client.ts tests/ai/client.test.ts
git commit -m "feat: call MiMo when OpenAI is unavailable"
```

---

### Task 3: Truthful provider disclosure in the UI

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/components/recall/recall-app.tsx`
- Modify: `src/app/globals.css`
- Modify: `tests/components/recall-app.test.tsx`

**Interfaces:**
- Consumes: `getAiProviderLabel()` from Task 1.
- Changes: `RecallApp` accepts optional `providerLabel?: string`; the production page always supplies the server-derived value.

- [ ] **Step 1: Add the failing page disclosure test**

In `tests/components/recall-app.test.tsx`, extend the existing cleanup so environment stubs cannot leak between tests:

```tsx
afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
```

Then add:

```tsx
it("shows the server-selected MiMo provider without exposing its key", () => {
  vi.stubEnv("OPENAI_API_KEY", "");
  vi.stubEnv("MIMO_API_KEY", "mimo-secret-value");

  render(<Page />);

  expect(screen.getByText("AI provider: MiMo V2.5")).toBeInTheDocument();
  expect(screen.queryByText(/mimo-secret-value/)).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run the single test and verify RED**

Run:

```powershell
npm test -- tests/components/recall-app.test.tsx -t "shows the server-selected MiMo provider"
```

Expected: FAIL because no provider label is rendered.

- [ ] **Step 3: Pass the server label into the client component**

Replace `src/app/page.tsx` with:

```tsx
import { RecallApp } from "@/components/recall/recall-app";
import { getAiProviderLabel } from "@/lib/ai/provider";

export default function Page() {
  return <RecallApp providerLabel={getAiProviderLabel()} />;
}
```

Change the component signature in `src/components/recall/recall-app.tsx`:

```tsx
type RecallAppProps = {
  providerLabel?: string;
};

export function RecallApp({
  providerLabel = "Configured by the server",
}: RecallAppProps) {
```

Add this immediately after the closing `</div>` for `.focus-card`:

```tsx
      <p className="provider-note">AI provider: {providerLabel}</p>
```

Add to `src/app/globals.css` after `.focus-card`:

```css
.provider-note {
  width: min(760px, 100%);
  margin: 12px auto 0;
  color: var(--muted);
  font-size: 0.75rem;
  text-align: right;
}
```

- [ ] **Step 4: Run component tests and verify GREEN**

Run:

```powershell
npm test -- tests/components/recall-app.test.tsx
```

Expected: all RecallApp component tests pass and the MiMo label test finds no secret value.

- [ ] **Step 5: Commit the disclosure UI**

```powershell
git add -- src/app/page.tsx src/components/recall/recall-app.tsx src/app/globals.css tests/components/recall-app.test.tsx
git commit -m "feat: disclose the active AI provider"
```

---

### Task 4: Configuration and judging documentation

**Files:**
- Modify: `.env.example`
- Modify: `README.md`
- Test: `tests/repository/hygiene.test.ts`

**Interfaces:**
- Documents the runtime behavior implemented in Tasks 1–3.
- Adds no production dependency and no secret value.

- [ ] **Step 1: Add failing repository expectations**

In `tests/repository/hygiene.test.ts`, add assertions to the existing environment/documentation test or create:

```ts
it("documents both server-only provider keys without values", () => {
  const example = readFileSync(".env.example", "utf8").replace(/\r\n/g, "\n");
  const readme = readFileSync("README.md", "utf8");

  expect(example).toBe("OPENAI_API_KEY=\nMIMO_API_KEY=\n");
  expect(readme).toContain("mimo-v2.5");
  expect(readme).toContain("OpenAI takes priority when both keys are set");
  expect(readme).not.toMatch(/(?:OPENAI|MIMO)_API_KEY=\S+/);
});
```

- [ ] **Step 2: Run the hygiene test and verify RED**

Run:

```powershell
npm test -- tests/repository/hygiene.test.ts
```

Expected: FAIL because `.env.example` and README do not yet document MiMo.

- [ ] **Step 3: Update safe environment documentation**

Replace `.env.example` with exactly:

```dotenv
OPENAI_API_KEY=
MIMO_API_KEY=
```

Replace the local requirements sentence and environment-variable section with:

```markdown
Requirements: Node.js 20.19 or newer and at least one supported server-side model key.

## Environment variables

- `OPENAI_API_KEY` selects `gpt-5.6`.
- If OpenAI is not configured, `MIMO_API_KEY` selects `mimo-v2.5` through Xiaomi's OpenAI-compatible Responses API.
- OpenAI takes priority when both keys are set.
- With neither key, only the disclosed exact built-in demo fallback can run.

Both variables are server-only and must never use a `NEXT_PUBLIC_` prefix. `.env.local` is ignored by Git. Never commit either key.
```

Replace the opening paragraph under “How GPT-5.6 is used” and the later “Normal requests” paragraph with:

```markdown
The primary implementation calls `gpt-5.6` through the OpenAI Responses API when `OPENAI_API_KEY` is configured. This is the competition path: four server-side model operations generate the open teachback prompt, diagnose three to five reasoning nodes, generate one targeted probe, and compare the original and revised explanations. Every model response uses strict structured outputs parsed into Zod contracts; evidence excerpts are additionally checked against the normalized source text before display.

When OpenAI credentials are unavailable and `MIMO_API_KEY` is configured, the hosted application uses Xiaomi `mimo-v2.5` through its OpenAI-compatible Responses API. The interface identifies this provider as MiMo V2.5; MiMo output is never represented as GPT-5.6 output. OpenAI takes priority if both keys are configured.

Every live request uses medium reasoning and a server-only credential. OpenAI requests additionally use `store: false` and a privacy-preserving session UUID as `safety_identifier`. Model refusals and invalid or unavailable responses are handled as typed failures rather than being displayed as invented learning feedback.

The exact scripted path described above remains the only answer path eligible for the disclosed built-in demo fallback. The fallback is considered only after an eligible live availability failure or invalid structured output.
```

Add this exact privacy paragraph:

```markdown
The study material, prompt context, original and revised explanations, and relevant prior-stage analysis are sent through the server to the selected live provider: OpenAI when configured, otherwise Xiaomi MiMo. Provider credentials remain server-side. Review the applicable provider terms before submitting sensitive material; Xiaomi's compatibility documentation is available at <https://mimo.mi.com/docs/en-US/api/chat/responses>.
```

- [ ] **Step 4: Run the hygiene test and verify GREEN**

Run:

```powershell
npm test -- tests/repository/hygiene.test.ts
```

Expected: all repository hygiene tests pass and no non-empty key appears.

- [ ] **Step 5: Commit configuration and README changes**

```powershell
git add -- .env.example README.md tests/repository/hygiene.test.ts
git commit -m "docs: document dual model providers"
```

---

### Task 5: Full verification and durable progress update

**Files:**
- Modify: `task_plan.md`
- Modify: `findings.md`
- Modify: `progress.md`

**Interfaces:**
- Consumes the completed implementation and fresh command output.
- Produces the handoff state for server deployment; it must not contain a secret.

- [ ] **Step 1: Run static and unit gates**

Run each command separately:

```powershell
npm run lint
npm test
```

Expected: lint exits 0 and every Vitest test passes with zero failures.

- [ ] **Step 2: Run browser and production gates**

Run each command separately:

```powershell
npm run test:e2e
npm run build
npm audit --omit=dev
```

Expected: all Playwright tests pass, production build exits 0, and the production dependency audit reports zero known vulnerabilities. If the audit reports a registry/network failure, record it as unverified rather than claiming success.

- [ ] **Step 3: Inspect the complete diff for scope and secrets**

Run:

```powershell
git diff --check
git status --short
git diff -- src tests .env.example README.md task_plan.md findings.md progress.md
```

Expected: no whitespace errors; only planned files are changed; no key value or unrelated user file is included.

- [ ] **Step 4: Update durable progress from verified evidence**

Update:

- `task_plan.md`: mark local MiMo implementation complete; keep server configuration and live MiMo verification pending.
- `findings.md`: record provider priority and that automated tests used no live API.
- `progress.md`: record exact fresh lint/test/E2E/build/audit counts and outcomes.

Do not state that the Azure deployment uses MiMo until the server is updated and a non-demo lesson succeeds.

- [ ] **Step 5: Commit the verified progress update**

```powershell
git add -- task_plan.md findings.md progress.md
git commit -m "docs: track MiMo integration verification"
```

- [ ] **Step 6: Prepare the server-only handoff**

Ask the user for the exact systemd unit name. Then provide commands that:

1. create or edit a root-readable environment file without echoing the key,
2. add `MIMO_API_KEY` directly in an interactive editor,
3. reference the file with a systemd drop-in,
4. restart the exact service,
5. check status without printing the environment,
6. run one arbitrary non-demo lesson through `https://recall-app.duckdns.org`.

Do not ask the user to paste the key into chat, a command argument, or a screenshot.
