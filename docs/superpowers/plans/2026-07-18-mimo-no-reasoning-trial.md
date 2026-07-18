# MiMo No-Reasoning Trial Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Test whether Recall's existing MiMo Responses integration can complete structured diagnosis reliably with reasoning disabled, a 2,048-token output cap, and a 75-second provider timeout.

**Architecture:** Preserve the current provider abstraction, Responses endpoint, JSON-object request format, validation, repair, retry, fallback, and public API behavior. Change only three MiMo-specific values, verify the full application locally, then use a staged Azure release and exactly one paid production flow to decide whether Responses remains viable.

**Tech Stack:** Next.js, TypeScript, OpenAI-compatible Responses API, Vitest, Playwright, systemd, Nginx, Azure VM.

## Global Constraints

- MiMo requests use exactly `reasoning: { effort: "none" }` and `max_output_tokens: 2_048`.
- `getProviderTimeoutMs("mimo")` returns exactly `75_000`; `getProviderTimeoutMs("openai")` remains exactly `25_000`.
- OpenAI remains on medium reasoning and receives no MiMo output cap.
- Keep the Responses API, JSON-object format, exact instructions, JSON parse, Zod/domain validation, one bounded structured-repair retry, existing availability retry counts, and fallback eligibility unchanged.
- Do not change API/domain schemas, UI behavior, dependencies, credentials, secret logging, or Nginx configuration. The deployed Recall server already has `proxy_read_timeout 120s`.
- Run exactly one paid production generate-and-diagnose flow after deployment.
- Accept a complete non-fallback diagnosis in at most 75 seconds; record 60–75 seconds as a performance risk.
- On HTTP 503, timeout, fallback, incomplete diagnosis, fewer than three nodes, missing probe, or elapsed time beyond 75 seconds: stop Responses experimentation, make no second paid call, and begin a separate Chat Completions design.

---

## Task 1: Disable MiMo reasoning and adjust its budget

**Files:**

- Modify: `tests/ai/client.test.ts`
- Modify: `src/lib/ai/client.ts`

**Interfaces:**

- Consumes: `AiProviderId = "openai" | "mimo"` and the existing `mimoStructuredRequest` call path.
- Produces: `getProviderTimeoutMs(providerId: AiProviderId): 25_000 | 75_000` and a MiMo Responses request containing the exact approved values.

- [ ] **Step 1: Change the timeout and request-shape tests first**

Update the existing timeout test to require:

```ts
it("uses a longer request timeout only for MiMo", () => {
  expect(getProviderTimeoutMs("mimo")).toBe(75_000);
  expect(getProviderTimeoutMs("openai")).toBe(25_000);
});
```

Rename the existing MiMo request test to
`uses no reasoning with a bounded MiMo JSON object output` and update only its
three budget assertions:

```ts
expect(request).toMatchObject({
  model: "mimo-v2.5",
  reasoning: { effort: "none" },
  max_output_tokens: 2_048,
  instructions: expect.any(String),
  input: options.input,
  text: { format: { type: "json_object" } },
});
```

Keep the separate exact `request.instructions` assertion and every negative
provider-isolation assertion unchanged.

- [ ] **Step 2: Run the focused tests and confirm RED**

```powershell
npx vitest run tests/ai/client.test.ts -t "uses a longer request timeout only for MiMo|uses no reasoning with a bounded MiMo JSON object output"
```

Expected: both tests fail because the implementation still returns 45,000 ms
and sends low reasoning with a 4,096-token cap.

- [ ] **Step 3: Implement the three exact MiMo-only values**

Update the timeout helper without changing how the SDK client consumes it:

```ts
export function getProviderTimeoutMs(
  providerId: AiProviderId,
): 25_000 | 75_000 {
  return providerId === "mimo" ? 75_000 : 25_000;
}
```

In `mimoStructuredRequest`, replace only the two existing budget fields:

```ts
reasoning: { effort: "none" },
max_output_tokens: 2_048,
```

- [ ] **Step 4: Run focused tests and confirm GREEN**

```powershell
npx vitest run tests/ai/client.test.ts
```

Expected: 29 tests pass, including timeout mapping, provider isolation, one
MiMo availability attempt, two OpenAI availability attempts, and the bounded
malformed-JSON repair path.

- [ ] **Step 5: Run the complete AI group**

```powershell
npx vitest run tests/ai
```

Expected: 3 files and 62 tests pass.

- [ ] **Step 6: Review and commit the minimal implementation**

```powershell
git diff --check
git diff -- src/lib/ai/client.ts tests/ai/client.test.ts
git add -- src/lib/ai/client.ts tests/ai/client.test.ts
git commit -m "fix: disable MiMo reasoning"
```

Expected: the production diff contains exactly the timeout return type/value,
MiMo reasoning value, and MiMo token cap; the test diff contains only their
expectations and the descriptive test rename.

---

## Task 2: Run the complete local verification gate

**Files:**

- Verify: `src/lib/ai/client.ts`
- Verify: `tests/ai/client.test.ts`
- Verify: repository test, lint, build, and browser suites

- [ ] **Step 1: Run all unit and integration tests**

```powershell
npm test -- --run
```

Expected: 11 test files and 174 tests pass.

- [ ] **Step 2: Run lint**

```powershell
npm run lint
```

Expected: exit code 0 with no diagnostics.

- [ ] **Step 3: Run the production build**

```powershell
npm run build
```

Expected: exit code 0; `/` and `/api/learn` remain dynamic routes.

- [ ] **Step 4: Run browser regression tests**

```powershell
npm run test:e2e
```

Expected: 6 of 6 pass and the command exits naturally with code 0. If all six
tests pass but sandbox cleanup times out, rerun the same command outside the
sandbox and require a natural exit code 0.

- [ ] **Step 5: Confirm implementation scope and worktree cleanliness**

```powershell
git diff 6728548..HEAD --check
git diff 6728548..HEAD -- src/lib/ai/client.ts tests/ai/client.test.ts
git status --short
```

Expected: implementation changes are confined to the three approved values and
their tests. Approved spec/plan documentation may also appear in the full
range; generated files and secrets must not be tracked.

- [ ] **Step 6: Obtain an independent code review**

Use the `requesting-code-review` skill. The reviewer must verify the three exact
values, Responses API preservation, OpenAI isolation, unchanged retry/repair/
fallback behavior, assertion strength, and all local gate evidence. Resolve
all Critical and Important findings and rerun affected tests before deployment.

---

## Task 3: Deploy and run one production acceptance flow

**Files and systems:**

- Deploy source: verified feature-branch commit
- Azure app: `/home/azureuser/recall`
- Staging: `/home/azureuser/recall-release-mimo-none-20260718`
- New rollback backup: `/home/azureuser/recall-backup-before-none-20260718`
- Preserve: `/home/azureuser/recall-backup-before-timeout-20260718`
- Preserve: `/home/azureuser/recall-backup-before-budget-20260718`
- Service: `recall.service`
- Public URL: `https://recall-app.duckdns.org`
- Evidence document: `docs/superpowers/plans/2026-07-18-mimo-no-reasoning-trial.md`

- [ ] **Step 1: Record the release SHA and build a tracked-only archive**

```powershell
git rev-parse HEAD
git status --short
git archive --format=tar.gz --output=recall-mimo-none-20260718.tar.gz HEAD
tar -tf recall-mimo-none-20260718.tar.gz | Select-String -Pattern "(^|/)(node_modules|\.next|\.env|\.git)(/|$)"
```

Expected: record the full SHA; status contains no unexpected files; the archive
scan returns no forbidden paths.

- [ ] **Step 2: Run read-only Azure preflight checks**

Using `azureuser@20.196.194.30` and the configured SSH key, verify:

- disk, memory, and swap capacity;
- `recall.service` is active and enabled;
- `/home/azureuser/recall` and protected `.env.production` ownership/modes;
- environment variable names only, never their values;
- both required old backups exist;
- `/home/azureuser/recall-backup-before-none-20260718` and the staging path do
  not already exist;
- the Recall Nginx server block still has `proxy_read_timeout 120s`.

If either new exact path already exists, stop rather than overwriting it.

- [ ] **Step 3: Upload and build the staged release**

Upload `recall-mimo-none-20260718.tar.gz`, create the exact staging directory
under `/home/azureuser`, extract the archive, copy the existing protected
`.env.production`, preserve owner `azureuser:azureuser` and mode `600`, then run:

```bash
npm ci
npm run build
```

Expected: both commands exit 0; `/` and `/api/learn` remain dynamic. Record but
do not remediate the two known moderate dependency audit findings.

- [ ] **Step 4: Switch with rollback protection**

Stop `recall.service`, move the current app to
`/home/azureuser/recall-backup-before-none-20260718`, move completed staging to
`/home/azureuser/recall`, restore ownership, and start the service. Use a bounded
startup readiness loop before the final health decision. If the service or final
local health check fails, restore the new rollback backup immediately.

- [ ] **Step 5: Verify deployment health**

Require all of:

- service active and enabled;
- local `http://127.0.0.1:3000` returns 200;
- public `https://recall-app.duckdns.org` returns 200;
- provider label is `MiMo V2.5`;
- recent logs show no startup error or credential output;
- all three named rollback backups remain present.

- [ ] **Step 6: Run exactly one paid controlled flow**

Use a novel, non-sensitive learning input and record only status, fallback flag,
elapsed time, node count, and probe presence. Do not record the complete prompt
or model output.

Required successful shape:

```text
generate: status=200, fallback=false
diagnose: status=200, fallback=false, nodes>=3, probe present, elapsed<=75s
```

Classify a diagnosis at most 60 seconds as healthy. Classify a successful
diagnosis between 60 and 75 seconds as accepted with a performance risk.

On any failure condition in Global Constraints, stop immediately. Do not click
retry, do not make a second paid API or browser flow, and do not adjust Responses
parameters. Begin a separate Chat Completions design only after recording the
failed evidence.

- [ ] **Step 7: Record observed evidence and commit it**

Append an evidence section to this plan containing the release SHA, archive
integrity, preflight/build/switch/health results, the single flow classification,
whether rollback occurred, retained backups, and local archive cleanup. State
explicitly whether product acceptance passed; never infer unobserved browser
success.

```powershell
git add -- docs/superpowers/plans/2026-07-18-mimo-no-reasoning-trial.md
git commit -m "docs: verify MiMo no-reasoning trial"
```

- [ ] **Step 8: Clean only the local release archive**

Resolve the absolute path of
`D:\UniFiles\ProjectRecall\.worktrees\mimo-timeout-retry\recall-mimo-none-20260718.tar.gz`,
verify it is inside the worktree, and delete only that file. Do not delete the
uploaded archive or any remote rollback backup without separate authorization.
