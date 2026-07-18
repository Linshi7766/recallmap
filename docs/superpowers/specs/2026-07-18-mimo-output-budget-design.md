# MiMo Output Budget Design

Date: 2026-07-18
Status: Approved in conversation; awaiting written-spec review

## Context and Evidence

The first timeout design deployed successfully but did not satisfy production
acceptance:

- the public service remained healthy and identified `MiMo V2.5`;
- a novel `generate_challenge` request returned HTTP 200 with
  `fallback=false`;
- the following `diagnose` request returned HTTP 503 after approximately
  119.9 seconds.

The earlier deployment increased MiMo's SDK timeout from 25 to 45 seconds and
removed hidden availability retries. That changed the failure duration but did
not make the sequential diagnosis and probe flow complete.

MiMo's official Responses API documentation states that `mimo-v2.5` defaults
to a 32,768-token output budget and that this budget includes visible output
and reasoning tokens. Recall currently supplies medium reasoning and does not
set `max_output_tokens`, even though each structured response is a small JSON
object. The working diagnosis is therefore excessive reasoning/output budget,
not service health, credentials, or the original SDK timeout alone.

Official references:

- https://platform.xiaomimimo.com/docs/en-US/api/chat/responses
- https://platform.xiaomimimo.com/docs/en-US/quick-start/model

## Goal

Bound MiMo's reasoning and total generation work so the existing two-step
diagnosis flow normally returns within approximately 90 seconds, without
changing OpenAI behavior or Recall's domain/API contracts.

## Non-goals

- Do not migrate MiMo to Chat Completions in this change.
- Do not combine diagnosis and probe into one operation.
- Do not change the 45-second MiMo SDK timeout or its one-attempt availability
  policy.
- Do not change OpenAI/GPT-5.6 request behavior.
- Do not change prompts, schemas, fallback eligibility, UI copy, persistence,
  dependencies, Nginx, systemd, or credentials.
- Do not add request/model content logging or timing telemetry.

## Chosen Design

### MiMo request budget

Every MiMo Responses request produced by `mimoStructuredRequest` will include:

```ts
reasoning: { effort: "low" },
max_output_tokens: 4_096,
```

The 4,096-token cap includes reasoning and visible output. It is one eighth of
the model's documented default, while remaining comfortably larger than
Recall's bounded Challenge, Diagnosis, Probe, and Repair JSON schemas.

The budget is provider-specific. OpenAI continues using medium reasoning and
does not receive this MiMo output cap.

### Existing reliability rules remain

- MiMo availability errors still stop after one request per explicit user
  action and map to the current HTTP 503 envelope.
- Malformed JSON, Zod schema failure, or trusted domain validation failure
  still receives one bounded repair attempt.
- Authentication failures, bad requests, refusals, invalid-output handling,
  and exact demo fallback rules remain unchanged.

## Data Flow

1. The browser sends the existing learning operation to `/api/learn`.
2. The provider resolver selects MiMo when OpenAI is absent and
   `MIMO_API_KEY` is present.
3. `mimoStructuredRequest` sends the existing instructions, input, JSON-object
   format, low reasoning, and a 4,096-token total output cap.
4. The raw JSON output follows the existing parse, Zod, domain-validation, and
   bounded repair path.
5. The route returns the unchanged `{ ok, data, fallback }` envelope.

No lesson text, answer, model output, or credential is added to logs or docs.

## Code Boundaries

- `src/lib/ai/client.ts`: change only MiMo request construction from medium to
  low reasoning and add `max_output_tokens: 4_096`.
- `tests/ai/client.test.ts`: update the existing MiMo request-shape test to
  require both exact values; keep OpenAI's medium-reasoning assertion.
- `progress.md`, `task_plan.md`, and `findings.md`: record only fresh production
  acceptance after deployment.

No new runtime file or dependency is required.

## Test Strategy

Follow red-green-refactor:

1. Change the MiMo request-shape test first to expect low reasoning and
   `max_output_tokens: 4_096`.
2. Run the focused test and observe failure against the current medium/no-cap
   request.
3. Make the two-field production change.
4. Run the focused client tests and all AI tests, explicitly retaining
   assertions for OpenAI medium reasoning, one-attempt MiMo availability
   failures, and two-attempt MiMo structured repair.
5. Run full Vitest, lint, production build, and E2E before deployment.

## Production Acceptance

Deploy with the existing staging-build and rollback-safe directory switch,
then require all of the following:

- `recall.service` active and enabled;
- local HTTP health and public HTTPS 200;
- public provider label `MiMo V2.5`;
- novel `generate_challenge`: HTTP 200, `ok=true`, `fallback=false`;
- following novel `diagnose`: HTTP 200, `ok=true`, `fallback=false`, at least
  three diagnosis nodes, and a non-empty probe question;
- normal diagnose route wall time approximately 90 seconds or less;
- browser repair flow reaches a result page with `Before → After` and an
  updated reasoning map.

If diagnose still returns 503, do not increase timeouts or token budgets again.
Record the failed evidence and begin a separate design for the documented Chat
Completions API with thinking disabled.

## Rollback

Retain `/home/azureuser/recall-backup-before-timeout-20260718` until the new
production acceptance and Devpost recording both succeed. A failed deployment
health check restores the immediately previous release through the existing
rollback-safe switch. A healthy deployment with failed AI acceptance remains
online only long enough to capture evidence and decide whether to restore or
continue with the separate Chat Completions design.

## Risks and Mitigations

- Low reasoning may reduce diagnosis quality. Existing schema/domain validation
  and the repair attempt remain the guardrails; browser acceptance checks the
  actual reasoning map.
- The combined reasoning and visible output might reach 4,096 tokens. The API
  will surface incomplete/invalid output through the existing validation path;
  this design does not silently accept truncation.
- A slow upstream response can still exceed 45 seconds. The existing explicit
  retry UI remains available without issuing a hidden duplicate paid request.
