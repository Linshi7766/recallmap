# Recall MiMo V2.5 Provider Design

Date: 2026-07-18
Status: Approved direction, pending written-spec review

## Objective

Allow the deployed Recall application to run arbitrary learning material with Xiaomi `mimo-v2.5` when no OpenAI API key is available, while preserving the existing GPT-5.6 path for competition compliance and future use. The application must identify the active provider honestly and must never commit, log, return, or display either provider's API key.

## Context and constraints

- The existing server uses the OpenAI Node SDK, Responses API parsing, Zod structured outputs, two-attempt validation repair, refusal detection, and typed availability failures.
- The deployed server currently has no `OPENAI_API_KEY`; the user can provide only a Xiaomi MiMo API key for `mimo-v2.5`, not `mimo-v2.5-pro`.
- OpenAI Build Week explicitly requires Codex and GPT-5.6. MiMo may therefore supplement the project but must not erase or masquerade as the GPT-5.6 implementation.
- Xiaomi documents an OpenAI-compatible Responses API at `https://api.xiaomimimo.com/v1`, but its accepted parameter set is not identical to OpenAI's.
- The exact built-in demo fallback must remain the last-resort path. It must not silently handle arbitrary input.

## Considered approaches

### 1. Dual-provider automatic selection — selected

Keep both integrations. At server startup, prefer GPT-5.6 when `OPENAI_API_KEY` exists; otherwise select `mimo-v2.5` when `MIMO_API_KEY` exists; otherwise report model unavailability so only the exact built-in demo may fall back.

This preserves the competition path, makes the current deployment useful, and limits changes to the model boundary.

### 2. Replace GPT-5.6 with MiMo — rejected

This is slightly smaller technically, but it removes the required model path and creates unnecessary submission risk.

### 3. Keep only the scripted fallback — rejected

This avoids integration work but cannot analyze arbitrary material and produces a weak judging experience.

## Architecture

Introduce a small provider-resolution boundary in `src/lib/ai/client.ts` or a focused adjacent module.

```text
Environment
  ├─ OPENAI_API_KEY present → OpenAI provider / gpt-5.6
  ├─ else MIMO_API_KEY present → Xiaomi provider / mimo-v2.5
  └─ else → MODEL_UNAVAILABLE

Selected provider
  → provider-specific OpenAI SDK client
  → provider-specific Responses request
  → existing Zod parse and domain validation
  → existing API route
  → exact demo fallback only for eligible failures
```

Provider resolution must be a pure, directly tested function. OpenAI wins when both keys exist. This avoids adding another configuration variable and keeps the competition model as the default.

## Provider configurations

### OpenAI

- API key: `OPENAI_API_KEY`
- Base URL: SDK default
- Model: `gpt-5.6`
- Preserve the existing request fields: medium reasoning, `store: false`, `safety_identifier`, instructions, input, strict Zod text format, and low verbosity.

### Xiaomi MiMo

- API key: `MIMO_API_KEY`
- Base URL: `https://api.xiaomimimo.com/v1`
- Model: `mimo-v2.5`
- Use the OpenAI SDK Responses parsing helper with the existing strict Zod schema.
- Build a reduced request containing only fields supported by Xiaomi's documented compatibility surface: model, instructions, input, reasoning, and structured text format.
- Do not send OpenAI-specific safety, storage, or verbosity fields unless a focused compatibility test establishes that Xiaomi accepts them.

The server client may be cached because environment configuration is expected to change only across service restarts.

## Data flow and truthful disclosure

The learning request and response data contracts remain unchanged. A server-derived label identifies the configured runtime:

- `GPT-5.6` when OpenAI is selected.
- `MiMo V2.5` when Xiaomi is selected.
- `Built-in demo fallback` when neither live provider is configured.

The label must reveal only the provider name, never whether a particular secret value exists beyond the resulting selection. It should appear unobtrusively in the application and be documented in the README. The demo video and submission text must not describe MiMo responses as GPT-5.6 responses.

## Error handling

- No configured key: throw `ModelUnavailableError`; exact demo requests may use the existing fallback.
- Network timeout, rate limit, or server failure: preserve the existing two-attempt behavior and typed `MODEL_UNAVAILABLE` mapping.
- Authentication or bad-request errors: do not hide them behind fallback; treat them as configuration/integration errors.
- Refusal: preserve `MODEL_REFUSED` without retry.
- Invalid structured or domain output: preserve one bounded repair attempt, then `MODEL_OUTPUT_INVALID`.
- Never include input, model output, validation values, or credentials in returned error messages.

## Testing strategy

Implementation will follow red-green-refactor.

1. Provider selection tests:
   - OpenAI is selected when only its key exists.
   - MiMo is selected when only its key exists.
   - OpenAI wins when both exist.
   - no keys produces an unavailable provider state.
2. Request-shape tests:
   - OpenAI payload remains byte-for-behavior compatible with existing expectations.
   - MiMo uses `mimo-v2.5`, Xiaomi's base URL, and omits unsupported OpenAI-only fields.
3. Error tests:
   - missing credentials map to `MODEL_UNAVAILABLE` and retain exact-demo fallback behavior.
   - authentication and bad-request failures remain non-fallback errors.
4. Disclosure tests:
   - each provider maps to the correct public label.
   - no secret value reaches rendered text or API envelopes.
5. Regression gates:
   - lint, unit/component tests, E2E tests, production build, and dependency audit.

No live API call is required in the automated suite. After deployment, the user will enter `MIMO_API_KEY` directly into the root-readable systemd environment file and run a manual non-demo material check.

## Documentation and deployment

- Add `MIMO_API_KEY=` to `.env.example` without a value.
- Update README setup, provider priority, runtime disclosure, and limitations.
- Preserve all existing instructions for `OPENAI_API_KEY`.
- Do not place secrets in `.env.example`, Git, screenshots, shell output, progress files, or chat.
- Deployment requires a service restart after adding `MIMO_API_KEY`; the key itself is entered only by the user on the server.

## Acceptance criteria

- With only `MIMO_API_KEY`, arbitrary pasted text can complete the full challenge, diagnosis, probe, and repair flow using `mimo-v2.5`.
- With only `OPENAI_API_KEY`, existing GPT-5.6 behavior is unchanged.
- With both keys, GPT-5.6 is used.
- With neither key, only the exact built-in demo fallback works.
- The application and README identify the configured provider truthfully.
- No credential is committed, logged, returned, or displayed.
- All local verification gates pass before deployment instructions are issued.

