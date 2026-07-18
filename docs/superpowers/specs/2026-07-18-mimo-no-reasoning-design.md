# MiMo No-Reasoning Trial Design

**Date:** 2026-07-18
**Status:** Approved for implementation planning

## Context

Recall currently calls Xiaomi `mimo-v2.5` through the OpenAI-compatible
Responses API. The deployed MiMo request uses low reasoning, a 4,096-token
output budget, and a 45-second provider timeout. Local verification passes,
generation succeeds in production, but diagnosis consistently reaches the
provider timeout and is returned to the browser as HTTP 503.

Fresh production evidence is consistent across server-side and browser tests:

- controlled generate: HTTP 200, `fallback=false`, 49.552 seconds;
- controlled diagnose: HTTP 503 after 45.906 seconds;
- user browser diagnose: unavailable after approximately 50 seconds.

The user's VPN is not the primary suspected cause because the model request is
made by the Azure VM, and the same failure occurs in a server-side controlled
flow. Xiaomi's current Responses API documentation supports
`reasoning: { effort: "none" }`, allowing Recall to disable model reasoning
without changing endpoints.

## Goal

Determine whether the existing Responses API can complete Recall's structured
diagnosis reliably when reasoning is fully disabled, the output budget is
reduced, and the provider timeout is extended only as a safety margin.

## Selected Approach

Keep the Responses API and change only the MiMo-specific request budget and
timeout:

```ts
reasoning: { effort: "none" },
max_output_tokens: 2_048,
```

```ts
getProviderTimeoutMs("mimo") === 75_000
getProviderTimeoutMs("openai") === 25_000
```

The 75-second timeout is a ceiling, not the performance target. The desired
diagnosis latency remains at most 60 seconds.

## Alternatives Considered

### Keep 4,096 output tokens

This reduces truncation risk but preserves more unnecessary generation work.
Recall's structured schemas are small enough that 2,048 total output tokens are
the better first experiment.

### Keep the 45-second timeout

This isolates the reasoning change more strictly, but current production
latency already reaches that boundary. It would not distinguish a modestly
slower successful response from the existing failure.

### Rewrite to Chat Completions immediately

Chat Completions exposes `thinking: { type: "disabled" }`, but it changes the
request and response adapters. Because Responses now supports `effort: "none"`,
the smaller change should be tested first. Chat Completions is the authorized
next design only if this trial fails acceptance.

## Scope

### Production code

- `src/lib/ai/client.ts`
  - change MiMo timeout from 45,000 to 75,000 milliseconds;
  - change MiMo reasoning from `low` to `none`;
  - change MiMo `max_output_tokens` from 4,096 to 2,048.

### Tests

- `tests/ai/client.test.ts`
  - require MiMo timeout 75,000 and OpenAI timeout 25,000;
  - require MiMo `reasoning: { effort: "none" }` and
    `max_output_tokens: 2_048`;
  - preserve the exact instructions assertion and all provider-isolation,
    retry, structured-repair, and fallback coverage.

### Explicitly out of scope

- changing the OpenAI request path;
- changing API or domain schemas;
- changing UI behavior or copy;
- changing retry counts or fallback eligibility;
- changing dependencies or credentials;
- changing to Chat Completions in the same implementation;
- logging secrets, complete prompts, or complete model output.

## Request and Error Flow

1. The provider resolver selects MiMo when `OPENAI_API_KEY` is absent and
   `MIMO_API_KEY` is present.
2. `getProviderTimeoutMs` configures the MiMo SDK client with a 75-second
   timeout while OpenAI remains at 25 seconds.
3. `mimoStructuredRequest` sends the existing model, instructions, input, and
   JSON-object format with reasoning disabled and a 2,048-token output cap.
4. Successful output continues through the existing JSON parse, Zod validation,
   domain validation, and bounded structured repair path.
5. Availability errors still receive one MiMo attempt per explicit user action.
6. The API continues returning the existing typed success or unavailable
   envelope; this design does not introduce a new error state.

## Verification

### Local gate

Before deployment, require:

- focused RED/GREEN tests for the three exact MiMo values;
- complete AI tests;
- complete repository suite: 11 files and 174 tests;
- lint exit code 0;
- production build exit code 0 with `/` and `/api/learn` dynamic;
- Playwright 6 of 6 with a natural exit code 0;
- diff limited to the MiMo request/timeout fields, their tests, and approved
  documentation.

### Deployment

Deploy through a clean archive and staging build. Preserve both existing
backups:

- `/home/azureuser/recall-backup-before-timeout-20260718`;
- `/home/azureuser/recall-backup-before-budget-20260718`.

Create a separate rollback backup for this release before switching the active
application. Keep credentials protected and never print their values.

### Production acceptance

After service, local HTTP, public HTTPS, provider label, and startup logs pass,
run exactly one controlled generate-and-diagnose flow.

- **Pass:** diagnosis returns HTTP 200, `fallback=false`, at least three valid
  reasoning nodes, and a probe within 75 seconds.
- **Healthy target:** the same successful result within 60 seconds.
- **Performance risk:** success between 60 and 75 seconds is temporarily
  accepted, but must be recorded as a demo risk.
- **Fail:** HTTP 503, timeout, fallback response, malformed/incomplete diagnosis,
  fewer than three nodes, missing probe, or elapsed time beyond 75 seconds.

If the trial fails, do not make a second paid production call and do not further
increase the Responses timeout or token budget. Record the evidence and begin a
separate Chat Completions design using `thinking: { type: "disabled" }`.

## Rollback and Safety

- If staging installation or build fails, do not switch production.
- If the service or health check fails after switching, restore the new rollback
  backup immediately.
- A model-level acceptance failure does not require automatic rollback when the
  service remains healthy and the previous release had the same diagnosis
  failure; retain the rollback option and report the result honestly.
- Do not delete any remote backup during this trial.

## Success Criteria

The trial is complete only when local gates pass, deployment health is verified,
and the single production diagnosis is classified using the thresholds above.
A healthy deployment with a failed diagnosis is not product acceptance.
