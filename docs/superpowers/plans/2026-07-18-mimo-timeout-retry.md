# MiMo Timeout and Retry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let normal slow MiMo diagnosis calls finish while preventing automatic duplicate paid requests after MiMo availability failures.

**Architecture:** Keep the existing `callStructured` abstraction and two-step diagnosis flow. Add a provider timeout policy used by the SDK client, then exit the attempt loop immediately for MiMo availability failures while retaining the second attempt for MiMo structured-output repair and all existing OpenAI behavior.

**Tech Stack:** TypeScript 6, Next.js 16 App Router, OpenAI JavaScript SDK 6, Zod 4, Vitest 4, systemd, Nginx, Azure Ubuntu 22.04.

## Global Constraints

- MiMo timeout is exactly `45_000` milliseconds; OpenAI remains `25_000` milliseconds.
- MiMo connection, timeout, rate-limit, HTTP 408, and HTTP 5xx failures receive one attempt per explicit user action.
- MiMo malformed JSON, Zod schema failure, and trusted domain validation failure retain one bounded repair attempt.
- OpenAI/GPT-5.6 request construction, timeout, and retry behavior remain unchanged.
- Do not change API envelopes, fallback eligibility, prompts, schemas, UI copy, dependencies, or credential handling.
- Do not log lesson content, model output, `OPENAI_API_KEY`, or `MIMO_API_KEY`.

---

## File Map

- Modify `src/lib/ai/client.ts`: provider timeout selection and provider-specific availability retry exit.
- Modify `tests/ai/client.test.ts`: timeout, MiMo attempt-count, and unchanged repair regression tests.
- Modify `progress.md`, `task_plan.md`, and `findings.md` only after production acceptance.
- Create no new runtime files and add no dependencies.

### Task 1: Provider-specific SDK timeout

**Files:**
- Modify: `tests/ai/client.test.ts:1-20`
- Modify: `src/lib/ai/client.ts:35-50`

**Interfaces:**
- Consumes: `AiProviderId = "openai" | "mimo"`.
- Produces: `getProviderTimeoutMs(providerId: AiProviderId): 25_000 | 45_000`.

- [ ] **Step 1: Write the failing test**

Change the client import and add:

```ts
import {
  callStructured,
  getProviderTimeoutMs,
} from "@/lib/ai/client";

it("uses a longer request timeout only for MiMo", () => {
  expect(getProviderTimeoutMs("mimo")).toBe(45_000);
  expect(getProviderTimeoutMs("openai")).toBe(25_000);
});
```

- [ ] **Step 2: Verify RED**

```bash
npx vitest run tests/ai/client.test.ts -t "uses a longer request timeout only for MiMo"
```

Expected: FAIL because `getProviderTimeoutMs` is not exported.

- [ ] **Step 3: Write the minimal implementation**

Add before `getClient`, then use it in the constructor:

```ts
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
```

- [ ] **Step 4: Verify GREEN and regression scope**

```bash
npx vitest run tests/ai/client.test.ts
```

Expected: all client tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/client.ts tests/ai/client.test.ts
git commit -m "fix: allow slower MiMo responses"
```

### Task 2: Stop hidden MiMo availability retries

**Files:**
- Modify: `tests/ai/client.test.ts` near the SDK availability tests.
- Modify: `src/lib/ai/client.ts:288-299`.

**Interfaces:**
- Consumes: `resolveAiProvider()` and `isUnavailableSdkError(error)`.
- Produces: one MiMo create attempt per availability failure; OpenAI retains two parse attempts.

- [ ] **Step 1: Write the failing attempt-count test**

```ts
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
```

Keep the existing OpenAI assertion `expect(parse).toHaveBeenCalledTimes(2)`.

- [ ] **Step 2: Verify RED**

```bash
npx vitest run tests/ai/client.test.ts -t "does not automatically retry MiMo SDK"
```

Expected: four failures because `create` was called twice.

- [ ] **Step 3: Implement the provider-specific exit**

Replace only the availability branch in the catch block:

```ts
      if (!isUnavailableSdkError(error)) {
        throw error;
      }
      lastError = error;
      if (provider.id === "mimo") {
        break;
      }
      continue;
```

- [ ] **Step 4: Verify GREEN and unchanged structured repair**

```bash
npx vitest run tests/ai/client.test.ts -t "does not automatically retry MiMo SDK|maps SDK|retries malformed MiMo JSON"
```

Expected: MiMo availability calls once, OpenAI availability calls twice, malformed MiMo JSON calls twice; all pass.

- [ ] **Step 5: Run all AI tests**

```bash
npx vitest run tests/ai/client.test.ts tests/ai/provider.test.ts tests/ai/operations.test.ts tests/api/learn-route.test.ts
```

Expected: all selected tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/ai/client.ts tests/ai/client.test.ts
git commit -m "fix: avoid duplicate MiMo availability retries"
```

### Task 3: Full local verification and review

**Files:**
- Inspect: `src/lib/ai/client.ts`
- Inspect: `tests/ai/client.test.ts`

**Interfaces:**
- Consumes: Tasks 1–2.
- Produces: a locally releasable commit with fresh verification evidence.

- [ ] **Step 1: Run all Vitest tests**

```bash
npm test -- --run
```

Expected: 11 files and at least 174 tests pass.

- [ ] **Step 2: Run lint and production build**

```bash
npm run lint
npm run build
```

Expected: both exit 0; `/` and `/api/learn` remain dynamic.

- [ ] **Step 3: Run E2E**

```bash
npm run test:e2e
```

Expected: 6/6 pass with natural exit 0. If sandbox webServer cleanup blocks exit after passing tests, rerun the same command in the approved non-sandbox environment.

- [ ] **Step 4: Inspect the implementation-only diff**

```bash
git diff HEAD~2..HEAD --check
git diff HEAD~2..HEAD -- src/lib/ai/client.ts tests/ai/client.test.ts
```

Expected: no whitespace errors and no changes outside the approved behavior.

- [ ] **Step 5: Request code review**

Use `requesting-code-review` against the two implementation commits. Block deployment on Critical or Important findings; fix and rerun affected verification first.

### Task 4: Rollback-safe Azure deployment and acceptance

**Files:**
- Generate: `recall-mimo-timeout-20260718.tar.gz`.
- Remote staging: `/home/azureuser/recall-release-mimo-timeout-20260718`.
- Remote backup: `/home/azureuser/recall-backup-before-timeout-20260718`.
- Modify after acceptance: `progress.md`, `task_plan.md`, `findings.md`.

**Interfaces:**
- Consumes: verified implementation HEAD and `C:\Users\15624\.ssh\id_ed25519`.
- Produces: healthy `recall.service` and a live non-fallback diagnosis plus probe.

- [ ] **Step 1: Create and scan the tracked-only archive**

```powershell
git archive --format=tar.gz --output recall-mimo-timeout-20260718.tar.gz HEAD
tar -tzf .\recall-mimo-timeout-20260718.tar.gz | Select-String -Pattern '(^|/)(\.env\.production|\.env\.local|node_modules|\.next|\.git)(/|$)'
```

Expected: the scan prints no matches.

- [ ] **Step 2: Verify remote paths are unused**

```powershell
ssh -i "$env:USERPROFILE\.ssh\id_ed25519" azureuser@20.196.194.30 'test ! -e /home/azureuser/recall-release-mimo-timeout-20260718 && test ! -e /home/azureuser/recall-backup-before-timeout-20260718 && echo paths-clear'
```

Expected: `paths-clear`.

- [ ] **Step 3: Upload and build in staging**

```powershell
scp -i "$env:USERPROFILE\.ssh\id_ed25519" .\recall-mimo-timeout-20260718.tar.gz azureuser@20.196.194.30:/home/azureuser/recall-mimo-timeout-20260718.tar.gz
ssh -i "$env:USERPROFILE\.ssh\id_ed25519" azureuser@20.196.194.30 'set -eu; mkdir -m 700 /home/azureuser/recall-release-mimo-timeout-20260718; tar -xzf /home/azureuser/recall-mimo-timeout-20260718.tar.gz -C /home/azureuser/recall-release-mimo-timeout-20260718; install -m 600 /home/azureuser/recall/.env.production /home/azureuser/recall-release-mimo-timeout-20260718/.env.production; cd /home/azureuser/recall-release-mimo-timeout-20260718; npm ci; npm run build'
```

Expected: production build exits 0 while the current service stays online.

- [ ] **Step 4: Switch with automatic rollback**

```powershell
ssh -i "$env:USERPROFILE\.ssh\id_ed25519" azureuser@20.196.194.30 'set -eu; OLD=/home/azureuser/recall-backup-before-timeout-20260718; NEW=/home/azureuser/recall-release-mimo-timeout-20260718; FAILED=/home/azureuser/recall-failed-mimo-timeout-20260718; test ! -e "$OLD"; test -d "$NEW"; test ! -e "$FAILED"; sudo systemctl stop recall.service; mv /home/azureuser/recall "$OLD"; mv "$NEW" /home/azureuser/recall; healthy=0; if sudo systemctl start recall.service; then for i in 1 2 3 4 5 6 7 8 9 10; do if curl -fsS http://127.0.0.1:3000/ >/dev/null; then healthy=1; break; fi; sleep 2; done; fi; if [ "$healthy" -eq 1 ]; then echo deploy-ok; exit 0; fi; sudo systemctl stop recall.service || true; mv /home/azureuser/recall "$FAILED"; mv "$OLD" /home/azureuser/recall; sudo systemctl start recall.service; echo rollback-complete >&2; exit 1'
```

Expected: `deploy-ok`; failure restores the previous release.

- [ ] **Step 5: Verify public health and provider**

```powershell
$response = Invoke-WebRequest -Uri 'https://recall-app.duckdns.org/' -UseBasicParsing -TimeoutSec 30
$provider = [regex]::Match($response.Content, 'AI provider:\s*(?:<!-- -->)?([^<]+)').Groups[1].Value
[PSCustomObject]@{ StatusCode = $response.StatusCode; Provider = $provider }
```

Expected: HTTP 200 and `MiMo V2.5`.

- [ ] **Step 6: Run novel generate and diagnose acceptance**

Send a new pasted lesson of at least 240 characters to `generate_challenge`; pass its exact challenge into `diagnose` with an explanation of at least 80 characters. Record only:

```text
generate: status=200, ok=true, fallback=false
diagnose: status=200, ok=true, fallback=false, diagnosis.nodes>=3, probe.question present
```

Expected: both HTTP 200; normal diagnosis route time approximately 90 seconds or less.

- [ ] **Step 7: Complete browser repair flow**

Use `Paste your own material` → `Reveal my blind spot` → `Work through this challenge` → `Check my repaired understanding`.

Expected: result shows one of `Understanding repaired`, `A key gap is smaller`, or `This gap still needs work`, plus `Before → After` and the updated reasoning map.

- [ ] **Step 8: Record evidence and commit docs**

Update `progress.md`, `task_plan.md`, and `findings.md` with the deployed commit, service health, provider, fallback flags, measured diagnosis time, and browser result. Do not record content, output, or credential values.

```bash
git add progress.md task_plan.md findings.md
git commit -m "docs: verify MiMo timeout recovery"
```

- [ ] **Step 9: Clean generated archive**

Resolve `D:\UniFiles\ProjectRecall\recall-mimo-timeout-20260718.tar.gz`, verify it is inside the workspace, and delete only that file. Retain the remote rollback backup until the Devpost demo is recorded.

## 2026-07-18 MiMo output-budget deployment evidence

- Release commit: `43f4cbbb39dfb4bc457b53730971696fe0156353`.
- Archive: tracked-only `recall-mimo-budget-20260718.tar.gz`; the exclusion scan found no `node_modules`, `.next`, `.env`, or `.git` entries. The local and uploaded archive SHA-256 values matched.
- Preflight: `/home/azureuser` had 54 GiB free; memory reported 315 MiB available with 1.3 GiB swap free. `recall.service` was active and enabled. `/home/azureuser/recall` was mode `700`; `.env.production` was mode `600`; both were owned by `azureuser:azureuser`. Only the environment variable name `MIMO_API_KEY` was observed.
- Staging: `.env.production` remained mode `600`; `npm ci` completed, reporting two moderate audit findings, and `npm run build` completed with the `/` and `/api/learn` dynamic routes.
- Release switch: succeeded without rollback. `recall.service` was active and enabled; local HTTP was `200`; public HTTP was `200`; the public provider label was `MiMo V2.5`. Recent startup logs showed Next.js ready in 153 ms, with no observed startup error or credential output.
- Exactly one live flow was attempted. Generate returned HTTP `200`, `ok=true`, `fallback=false` in 49.552 s. Diagnose returned HTTP `503` in 45.906 s; no success envelope was available, so no fallback value was observed, node count was `0`, and no probe was present. Total elapsed time was 95.484 s.
- Per the acceptance stop rule, no second paid call was made and no timeout or token setting was changed. The required non-fallback diagnosis result was not achieved.
- Browser flow: not run after the HTTP `503`, because it would have triggered another paid generate/diagnose flow contrary to the stop rule. User-visible diagnosis rendering remains unverified.
- Remote rollback backups observed and retained: `/home/azureuser/recall-backup-before-timeout-20260718` and `/home/azureuser/recall-backup-before-budget-20260718`.
