# MiMo Output Budget Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make MiMo V2.5 complete Recall's structured generation and diagnosis requests reliably by bounding reasoning and output work, while preserving the existing OpenAI path and all public behavior.

**Architecture:** Keep the existing Responses API provider abstraction. Change only the MiMo request shape to use low reasoning effort and a 4,096-token output budget; retain the existing provider-specific timeout, retry, validation, repair, and fallback behavior. Verify locally, then deploy through a staged, rollback-safe Azure release and stop immediately if the live diagnosis still returns 503.

**Tech Stack:** Next.js, TypeScript, OpenAI-compatible Responses API, Vitest, Playwright, systemd, Nginx, Azure VM.

## Global Constraints

- MiMo requests must use exactly `reasoning: { effort: "low" }` and `max_output_tokens: 4_096`.
- OpenAI requests must remain at medium reasoning and must not receive the MiMo output cap.
- Existing timeouts remain unchanged: MiMo 45,000 ms and OpenAI 25,000 ms.
- MiMo availability failures receive one attempt; OpenAI availability failures retain two attempts; malformed MiMo structured output retains one repair retry.
- Do not change API response schemas, UI behavior, fallback behavior, dependencies, credentials, or secret logging.
- If the live diagnosis still returns HTTP 503, stop. Do not increase the timeout or output-token budget again; a separate design must evaluate Chat Completions with thinking disabled.

---

## Task 1: Bound MiMo reasoning and output

**Files:**

- Modify: `tests/ai/client.test.ts`
- Modify: `src/lib/ai/client.ts`

- [ ] **Step 1: Update the MiMo request-shape test first**

Rename the existing MiMo JSON-object request test to `uses bounded low reasoning for MiMo JSON object output`. Keep its existing assertions and require this request shape:

```ts
expect(request).toMatchObject({
  model: "mimo-v2.5",
  reasoning: { effort: "low" },
  max_output_tokens: 4_096,
  instructions: expect.any(String),
  input: options.input,
  text: { format: { type: "json_object" } },
});
```

Keep the existing negative assertions that MiMo does not receive OpenAI strict-schema fields.

- [ ] **Step 2: Run the focused test and confirm RED**

Run:

```powershell
npx vitest run tests/ai/client.test.ts -t "uses bounded low reasoning for MiMo JSON object output"
```

Expected: failure because the current request uses medium reasoning and omits `max_output_tokens`.

- [ ] **Step 3: Implement the minimal MiMo-only request change**

In `mimoStructuredRequest`, set:

```ts
reasoning: { effort: "low" },
max_output_tokens: 4_096,
```

Do not modify the OpenAI request builder, provider timeout mapping, retry loop, validation, repair prompt, or fallback logic.

- [ ] **Step 4: Run focused regression tests and confirm GREEN**

Run the request-shape test plus the existing tests covering provider timeouts, one MiMo availability attempt, two OpenAI availability attempts, and two malformed-JSON attempts:

```powershell
npx vitest run tests/ai/client.test.ts
```

Expected: all tests in the file pass.

- [ ] **Step 5: Run the complete AI test group**

```powershell
npx vitest run tests/ai
```

Expected: 79 tests pass with no failures.

- [ ] **Step 6: Review and commit the implementation**

```powershell
git diff --check
git diff -- src/lib/ai/client.ts tests/ai/client.test.ts
git add -- src/lib/ai/client.ts tests/ai/client.test.ts
git commit -m "fix: bound MiMo reasoning output"
```

Confirm the diff contains only the test expectation and the two MiMo request fields.

---

## Task 2: Run the complete local verification gate

**Files:**

- Verify: `src/lib/ai/client.ts`
- Verify: `tests/ai/client.test.ts`
- Verify: repository test, lint, build, and browser suites

- [ ] **Step 1: Run the complete unit and integration suite**

```powershell
npm test -- --run
```

Expected: 11 test files and 174 tests pass.

- [ ] **Step 2: Run lint**

```powershell
npm run lint
```

Expected: exit code 0.

- [ ] **Step 3: Run the production build**

```powershell
npm run build
```

Expected: exit code 0, with `/` and `/api/learn` remaining dynamic routes.

- [ ] **Step 4: Run the browser suite**

```powershell
npm run test:e2e
```

Expected: 6 of 6 tests pass and the command exits naturally. If all six tests pass but sandbox cleanup times out, rerun this same command outside the sandbox and require a natural exit code 0.

- [ ] **Step 5: Confirm implementation scope**

```powershell
git diff 5b4f64c..HEAD --check
git diff 5b4f64c..HEAD -- src/lib/ai/client.ts tests/ai/client.test.ts
git status --short
```

Expected: implementation changes are limited to the MiMo request shape and its test. Documentation commits may also exist, and no generated or secret files may be tracked.

- [ ] **Step 6: Request an independent code review**

Use the `requesting-code-review` skill. The reviewer must verify MiMo/OpenAI isolation, exact budget values, preserved retry semantics, and test coverage. Address any findings and rerun affected verification commands before deployment.

---

## Task 3: Deploy and verify one production learning flow

**Files and systems:**

- Deploy source: the verified feature-branch commit
- Azure app: `/home/azureuser/recall`
- Staging directory: `/home/azureuser/recall-release-mimo-budget-20260718`
- New rollback backup: `/home/azureuser/recall-backup-before-budget-20260718`
- Preserve existing backup: `/home/azureuser/recall-backup-before-timeout-20260718`
- Service: `recall.service`
- Public URL: `https://recall-app.duckdns.org`
- Update: `docs/superpowers/plans/2026-07-18-mimo-timeout-retry.md`

- [ ] **Step 1: Record the release commit and build a clean archive**

```powershell
git rev-parse HEAD
git status --short
git archive --format=tar.gz --output=recall-mimo-budget-20260718.tar.gz HEAD
tar -tf recall-mimo-budget-20260718.tar.gz | Select-String -Pattern "(^|/)(node_modules|\.next|\.env|\.git)(/|$)"
```

Expected: record the full commit SHA, the archive contains no dependencies, build output, environment files, or Git metadata, and unrelated user files are not included.

- [ ] **Step 2: Run read-only Azure preflight checks**

Using the configured SSH key and `azureuser@20.196.194.30`, verify disk space, memory, `recall.service`, `/home/azureuser/recall`, and the protected `.env.production` file. Check only the environment variable names; never print secret values.

- [ ] **Step 3: Upload and build in staging**

Upload `recall-mimo-budget-20260718.tar.gz`, recreate only the exact staging directory, extract the archive there, copy the existing protected `.env.production` into staging, then run:

```bash
npm ci
npm run build
```

Expected: both commands succeed and the environment file remains readable only by its intended owner.

- [ ] **Step 4: Perform a rollback-safe release switch**

Stop `recall.service`, move the current `/home/azureuser/recall` to `/home/azureuser/recall-backup-before-budget-20260718`, move the completed staging directory to `/home/azureuser/recall`, restore correct ownership, and start the service. If the service or local health check fails, immediately restore the new backup and report the rollback.

Do not remove `/home/azureuser/recall-backup-before-timeout-20260718`.

- [ ] **Step 5: Verify service and public health**

Verify:

- `recall.service` is active and enabled.
- `http://127.0.0.1:3000` returns HTTP 200.
- `https://recall-app.duckdns.org` returns HTTP 200.
- The runtime provider label is `MiMo V2.5`.
- Recent service logs contain no startup error and do not expose credentials.

- [ ] **Step 6: Run exactly one paid live generate-and-diagnose flow**

Use a small controlled learning input. Record status, fallback flag, elapsed time, and diagnosis structure without logging secrets or full sensitive prompts.

Required result:

```text
generate: status=200, fallback=false
diagnose: status=200, fallback=false, nodes>=3, probe present
```

Target total elapsed time: at most about 90 seconds. If diagnosis returns HTTP 503, do not make a second paid call and do not adjust timeout or token settings; stop and report that the approved Chat Completions design is now required.

- [ ] **Step 7: Verify the user-visible browser flow**

In a browser, complete the flow through “Reveal my blind spot” and confirm a diagnosis renders instead of “Recall is temporarily unavailable.” If the executing agent has no browser access, ask the user for this one verification and a screenshot; do not mark deployment complete without it.

- [ ] **Step 8: Record only observed evidence**

Update `docs/superpowers/plans/2026-07-18-mimo-timeout-retry.md` with the deployed commit, exact verification results, elapsed times, and any failure. Never claim success for an unverified browser or API step.

```powershell
git add -- docs/superpowers/plans/2026-07-18-mimo-timeout-retry.md
git commit -m "docs: verify MiMo output budget"
```

- [ ] **Step 9: Clean up the local release archive**

Remove only `recall-mimo-budget-20260718.tar.gz` after verification. Retain the two named remote backups until the user explicitly approves cleanup.
