# Recall

Explain it. Expose the gap. Repair your understanding.

## What it does

Recall is a focused learning tool for exposing and repairing misconceptions. A student teaches a concept back in their own words, sees a source-grounded reasoning map, works through one targeted challenge, and revises the explanation. Recall then compares the original and revised reasoning and reports whether the important gap was repaired.

The app includes a ready-to-run lesson on correlation and causation. It requires no Recall account, and the deployed experience is designed so a judge does not need a personal API key.

## Why it is different

Recall does not begin by supplying a polished answer or another multiple-choice quiz. It first captures the student's mental model. It then separates supported reasoning from incomplete or unsupported links, quotes evidence from the supplied material, and asks exactly one counterexample, Socratic question, or transfer question. If every reasoning node is supported, it does not invent a mistake.

The final screen makes the conceptual change inspectable through a Before/After comparison, updated reasoning nodes, and—only for a repaired result—a short recall card.

## Try the built-in demo

1. Select **Start sample lesson**. No app account or setup is required.
2. Enter the tested first explanation:

   > If two variables consistently move together, one probably causes the other unless the data has an error.

3. Select **Reveal my blind spot** and inspect the priority gap and its source evidence.
4. Select **Work through this challenge**, then enter the tested revision:

   > Correlation shows that variables move together, but it does not reveal why. The association may come from direct causation, reverse causation, a common cause such as temperature, selection bias, or chance, so additional evidence is required.

5. Select **Check my repaired understanding** to see the repaired reasoning map and Before/After result.

## How live providers are used

The primary implementation calls `gpt-5.6` through the OpenAI Responses API when `OPENAI_API_KEY` is configured. This is the competition path: four server-side model operations generate the open teachback prompt, diagnose three to five reasoning nodes, generate one targeted probe, and compare the original and revised explanations. OpenAI uses server-enforced strict JSON Schema through `responses.parse`, followed by the application's Zod and domain checks.

When OpenAI credentials are unavailable and `MIMO_API_KEY` is configured, the application can use Xiaomi `mimo-v2.5` through its OpenAI-compatible Responses API. MiMo uses JSON object mode: trusted instructions require one JSON object and include the exact JSON Schema derived from the operation's Zod contract, while lesson and user content remain in `input`. The raw `output_text` is parsed as JSON and validated locally with the same Zod and domain checks, including one bounded repair retry. The interface identifies this provider as MiMo V2.5; MiMo output is never represented as GPT-5.6 output. OpenAI takes priority if both keys are configured.

Live non-demo MiMo acceptance is still pending. Automated tests validate the local request, parsing, retry, and redaction behavior without claiming that production credentials or the live Xiaomi endpoint have been accepted.

Every live request uses medium reasoning and a server-only credential. OpenAI requests additionally use `store: false` and a privacy-preserving session UUID as `safety_identifier`. Model refusals and invalid or unavailable responses are handled as typed failures rather than being displayed as invented learning feedback.

The exact scripted path described above remains the only answer path eligible for the disclosed built-in demo fallback. The fallback is considered only after an eligible live availability failure or invalid structured output.

## How Codex accelerated the build

Codex researched the product and API constraints, turned the design into an implementation plan, implemented the Next.js application and its typed boundaries, and built the unit, component, route, and browser test coverage. Codex also exercised failure recovery and responsive behavior during development.

Codex is not a tutor running inside Recall. The selected live provider performs the source-grounded learning analysis at runtime; Codex was the development tool used to research, plan, implement, and test the project.

## Architecture

```text
Browser Guided UI
  ├─ localStorage: recoverable active session and student progress
  └─ POST /api/learn: source, explanations, and typed prior-stage data
       └─ server-only selected live provider gateway
            ├─ OpenAI strict JSON Schema or MiMo JSON object response
            ├─ Zod contract validation
            └─ exact source-evidence verification
```

The browser follows five internal states (`start`, `teachback`, `diagnosis`, `repair`, and `result`) presented as four visible learning steps. The single Next.js route validates three request operations and dispatches four focused selected-provider calls. There is no authentication and no server database.

## Local setup

Requirements: Node.js 20.19 or newer and at least one supported server-side model key.

```powershell
npm ci
Copy-Item .env.example .env.local
# Set OPENAI_API_KEY or MIMO_API_KEY in .env.local
npm run dev
```

Open `http://127.0.0.1:3000`.

## Environment variables

- `OPENAI_API_KEY` selects `gpt-5.6`.
- If OpenAI is not configured, `MIMO_API_KEY` selects `mimo-v2.5` through Xiaomi's OpenAI-compatible Responses API.
- OpenAI takes priority when both keys are set.
- With neither key, only the disclosed exact built-in demo fallback can run.

Both variables are server-only and must never use a `NEXT_PUBLIC_` prefix. `.env.local` is ignored by Git. Never commit either key.

## Test commands

Install the Playwright browser once:

```powershell
npx playwright install chromium --only-shell
```

Run each local gate with one command:

```powershell
npm run lint
npm run test
npm run test:e2e
npm run build
npm audit --omit=dev
```

The E2E suite intercepts `/api/learn` and uses exported, contract-validated fixtures. It never calls a real provider API or depends on network responses.

## Demo fallback disclosure

Recall attempts the selected live provider first. A fallback is considered only when that live provider operation ends in an eligible availability failure or invalid structured output. It then matches the complete request against the built-in correlation-and-causation source and the exact scripted challenge, first explanation, diagnosis/probe, and revision exported by the application. A matching response is returned with `fallback: true`.

The fallback is never used after a model refusal, for modified demo inputs, or for arbitrary pasted material. Pasted material always requires live analysis and receives an explicit error if the live model cannot complete the operation.

## Privacy and limitations

Recoverable progress is stored in the current browser's `localStorage`; clearing site data removes it. Recall has no server database and does not create learner accounts.

The study material, prompt context, original and revised explanations, and relevant prior-stage analysis are sent through the server to the selected live provider: OpenAI when configured, otherwise Xiaomi MiMo. Provider credentials remain server-side. Review the applicable provider terms before submitting sensitive material; Xiaomi's compatibility documentation is available at <https://mimo.mi.com/docs/en-US/api/chat/responses>.

Study material is treated as untrusted reference data and delimited from instructions. Evidence checks reduce fabricated quotations, but model-generated diagnoses can still be incomplete or wrong. Recall is an educational aid, not a grading authority or a medical, psychological, or permanent assessment. Users should compare important conclusions with the original source. The MVP accepts the built-in lesson or pasted text only, has no PDF import, and keeps progress only in one browser.

## License

No open-source license has been granted. This repository is currently marked `UNLICENSED` and is provided for competition judging and evaluation; no permission for reuse, modification, or redistribution is implied.
