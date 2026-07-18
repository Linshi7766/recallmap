# MiMo Timeout and Retry Design

Date: 2026-07-18
Status: Approved in conversation; awaiting written-spec review

## Problem

The production `generate_challenge` operation succeeds through MiMo, but the
`diagnose` route can fail with HTTP 503 and the UI message “Recall is
temporarily unavailable.” A controlled production reproduction produced this
sequence:

- `generate_challenge`: HTTP 200, `fallback=false`, 29.9 seconds.
- `diagnose`: HTTP 503 after 51 seconds.

The AI client currently gives every provider a 25-second SDK timeout and its
two-attempt loop immediately retries availability failures. The 51-second
failure therefore matches two consecutive 25-second upstream timeouts. The
input, API key, public HTTPS route, and systemd service were independently
shown to work.

## Goal

Make the MiMo diagnosis flow reliable for normal responses that take longer
than 25 seconds, while keeping the visible analysis wait near 90 seconds and
avoiding automatic duplicate paid requests after availability failures.

## Non-goals

- Do not combine diagnosis and probe into one response.
- Do not change OpenAI/GPT-5.6 timeout or retry behavior.
- Do not change schemas, prompts, API envelopes, fallback eligibility, or UI
  copy.
- Do not add a job queue, streaming transport, telemetry service, or new
  dependency.

## Chosen Design

### Provider-specific timeout

The SDK client will use a 45-second timeout for MiMo and retain the existing
25-second timeout for OpenAI. Forty-five seconds gives the observed
approximately 30-second MiMo responses enough headroom. The sequential
diagnosis and probe calls should normally finish within roughly 90 seconds.

### Provider-specific availability retry

For MiMo, an SDK availability error will stop the current structured call
immediately instead of consuming the second attempt. Availability errors are:

- connection errors and timeouts;
- rate limiting;
- HTTP 408;
- HTTP 5xx.

The route continues mapping this condition to HTTP 503 and the existing safe
retry message. The user can explicitly click `Retry analysis`, making any
second paid request intentional.

OpenAI retains the existing two-attempt behavior for availability failures.

### Structured-output repair remains unchanged

MiMo still receives one bounded repair attempt when its response is malformed
JSON, fails the Zod schema, or fails domain validation. This is not an
availability retry: it sends safe validation feedback and is necessary to
recover a usable structured answer. Refusals, authentication failures, and bad
requests retain their current behavior.

## Data Flow

1. The browser sends the existing `diagnose` request to `/api/learn`.
2. `diagnoseExplanation` calls MiMo with a 45-second SDK timeout.
3. If the response is structurally valid, the result is validated and retained.
4. `generateChallengeProbe` then makes the second MiMo call with the same
   timeout policy.
5. A MiMo availability failure from either call returns the existing HTTP 503
   envelope without an immediate hidden retry.
6. A malformed or schema-invalid response receives one repair attempt before
   the existing invalid-output handling applies.

No source material, model output, or credential is added to logs.

## Code Boundaries

- `src/lib/ai/client.ts`: select timeout by provider and stop MiMo availability
  retries after the first failed attempt.
- `tests/ai/client.test.ts`: add regression coverage for timeout selection and
  MiMo availability attempt count; retain coverage proving validation repair
  still gets two attempts.
- Documentation is updated only if implementation changes an externally
  observable operational fact.

## Test Strategy

Follow red-green-refactor:

1. Add a failing test proving a MiMo availability error invokes the create
   request once rather than twice.
2. Add a failing test proving the MiMo SDK client is configured with a
   45,000-millisecond timeout while OpenAI remains at 25,000 milliseconds.
3. Run the focused client tests and confirm each new test fails for the intended
   missing behavior.
4. Implement only the timeout selection and provider-specific retry exit.
5. Run focused AI tests, all Vitest tests, lint, and production build.
6. Deploy through the existing staged build and rollback-safe directory switch.

## Production Acceptance

After deployment:

- `recall.service` is active and local HTTP health passes.
- The public homepage returns HTTP 200 and still displays `MiMo V2.5`.
- A novel `generate_challenge` request returns `fallback=false`.
- A novel `diagnose` request returns HTTP 200 with a diagnosis and probe.
- The browser can advance from `Reveal my blind spot` to the reasoning map.

The previous production release remains available for rollback until this
acceptance passes.

## Risks and Mitigations

- A MiMo response can still exceed 45 seconds. The existing safe retry UI
  remains available, and no hidden duplicate request is issued.
- A validation-repair attempt can extend the total beyond the typical
  90-second target. This is bounded to one attempt and is distinct from an
  upstream availability retry.
- Provider-client caching can obscure timeout tests. Tests must exercise the
  real client construction boundary or a small pure timeout selector, without
  adding production-only test hooks.
