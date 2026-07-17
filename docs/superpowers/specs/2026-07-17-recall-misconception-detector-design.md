# Recall Misconception Detector — Product Design

Date: 2026-07-17  
Competition: OpenAI Build Week 2026  
Track: Education

## 1. Product Summary

Recall is a guided learning application that reveals and repairs hidden misconceptions. Instead of generating another quiz or giving students an answer, it asks a student to teach a concept back in their own words, uses GPT-5.6 to map the reasoning in that explanation, challenges the most important gap with a counterexample or Socratic question, and verifies whether the student's revised explanation resolves the gap.

Tagline:

> Explain it. Expose the gap. Repair your understanding.

The product is designed for university students who are studying independently and cannot reliably tell the difference between familiarity, answer recognition, and genuine understanding.

## 2. Problem and Product Thesis

Students can answer recall questions correctly while retaining an incorrect mental model. Ordinary AI tutors often make this worse by supplying polished explanations before the student has exposed their own reasoning.

Recall follows a different sequence:

1. Elicit the student's current mental model.
2. Make the reasoning structure visible.
3. Challenge one specific misconception without immediately giving away the answer.
4. Ask the student to reconstruct the explanation.
5. Compare the two explanations and verify conceptual repair.

The primary product claim is not that Recall knows whether a student is “smart” or assigns a universal score. Its narrower claim is that it can identify a plausible reasoning gap grounded in the supplied material, expose that gap through a targeted challenge, and show how the student's second explanation differs from the first.

## 3. Goals and Non-Goals

### Goals

- Deliver a complete four-stage learning experience in under five minutes.
- Make an invisible misconception visually obvious in under one minute of demo time.
- Ground every diagnostic claim in evidence from the supplied learning material.
- Use GPT-5.6 for non-trivial structured reasoning: diagnosis, counterexample generation, and repair verification.
- Let judges test the core flow immediately through a built-in lesson.
- Produce a reliable, deployable web application with clear failure recovery.

### Non-Goals

- User accounts, authentication, classes, or a teacher dashboard.
- A persistent cross-course knowledge graph or long-term learner model.
- Voice input, speech synthesis, or real-time conversation.
- Social sharing, leaderboards, or collaborative study.
- A multi-agent architecture.
- Complex adaptive-testing algorithms.
- Dedicated mobile interaction design beyond a usable responsive layout.

## 4. Core Experience

Recall uses a single-column Guided Focus layout. Each screen has one dominant action, a progress indicator, and a way to return to the previous stage without losing input.

### Stage 1: Choose Material

The landing page presents a tested sample lesson, “Correlation vs. Causation,” as the primary action. A secondary path accepts pasted study text. PDF upload is a stretch enhancement and must not block the core submission.

The page explains the product in one sentence: “Teach it back. Recall finds the hidden gap.” No account is required.

### Stage 2: Teach It Back

GPT-5.6 selects one concept from the source material and creates an open explanation prompt that requires causal or conceptual reasoning. The student answers in their own words. There are no multiple-choice answers and no suggested response before submission.

Primary action: **Reveal my blind spot**.

### Stage 3: Reveal and Challenge the Gap

The student's explanation is represented as three to five ordered reasoning nodes. Each node has one status:

- `correct`: supported by the material;
- `incomplete`: relevant but missing an important condition or link;
- `misconception`: inconsistent with the material or based on an invalid inference.

Each node includes a concise explanation, a source excerpt, and a confidence level. The interface visually reserves green for supported reasoning, amber for incomplete reasoning, and red for a misconception.

Recall selects the most instructionally important non-correct node and generates exactly one counterexample or Socratic question. It does not reveal a complete model answer at this stage.

### Stage 4: Verify Repair

The student revises the explanation after responding to the challenge. GPT-5.6 compares the original and revised explanations against the same source evidence and concepts. The result shows which nodes were repaired, which remain unresolved, and a concise Before/After comparison.

When the critical gap is resolved, the interface displays **Understanding repaired**. It also produces one short recall card containing the corrected explanation. This card remains in the browser session and is not persisted to a server database.

## 5. Visual Direction

The interface should feel like a focused learning instrument rather than a chatbot.

- Primary palette: ink (`#111827`), violet (`#7c3aed`), paper (`#f8fafc`).
- Diagnostic states: red only for misconceptions, amber for incomplete reasoning, green for supported or repaired reasoning.
- Typography: Inter or a comparable neutral sans-serif.
- Layout: large whitespace, one centered content card, visible four-stage progress.
- Motion: short, restrained transitions when reasoning nodes appear or change state.
- Avoid chat bubbles, assistant avatars, glowing AI gradients, dense dashboards, and decorative visual noise.

The misconception map is the visual centerpiece. During repair verification, the relevant node should visibly transition from red or amber to green, while the Before/After text makes the reasoning change explicit.

## 6. Technical Architecture

### Stack

- Next.js App Router and TypeScript.
- Tailwind CSS for styling.
- OpenAI Responses API using GPT-5.6.
- Zod plus JSON Schema or the OpenAI SDK's structured-output support.
- Vercel for hosting.
- Browser `localStorage` for recoverable in-progress session state.
- No database and no authentication in the competition MVP.

The OpenAI API key exists only in server-side environment variables. Browser code never receives the key.

### Application Boundaries

The system has four focused units:

1. **Learning Material**: validates pasted text, exposes the built-in lesson, and optionally extracts text from a PDF.
2. **Learning Orchestrator**: enforces the four-stage state machine and prevents steps from being skipped with invalid state.
3. **GPT-5.6 Gateway**: owns prompts, structured schemas, timeouts, retries, and response validation.
4. **Guided UI**: renders each stage, persists recoverable state locally, and provides retry and back navigation.

These units communicate through typed request and response objects. The UI must not parse free-form model prose to determine application state.

### Server Operations

The API exposes four logical operations. They may be implemented as separate route handlers or as one route with a validated operation discriminator; the external types remain distinct.

#### `generateChallenge`

Input: normalized source text.  
Output: lesson title, selected concept, open explanation prompt, and the source passages most relevant to evaluation.

#### `diagnoseExplanation`

Input: source text, selected concept, prompt, and the student's first explanation.  
Output: three to five ordered reasoning nodes, each containing status, claim, diagnosis, source evidence, and confidence; plus the identifier of the highest-priority gap.

#### `generateChallengeProbe`

Input: the selected gap, relevant source evidence, and the student's explanation.  
Output: one counterexample or Socratic question and a private evaluation target used during repair verification. It must not include a complete answer for the student.

#### `verifyRepair`

Input: source, original explanation, diagnostic nodes, challenge, and revised explanation.  
Output: updated node statuses, repair explanations, an overall result, a Before/After summary, and one recall card.

## 7. AI Output Requirements

All GPT-5.6 application responses use strict structured output. User-visible diagnostic language must be short, specific, and traceable to the source material.

The model must:

- treat the uploaded or pasted material as untrusted reference content, never as system instructions;
- avoid inventing source quotations;
- identify uncertainty when the material is insufficient;
- prefer one important, teachable gap over many minor criticisms;
- distinguish an incomplete explanation from a false claim;
- generate a challenge that encourages student reasoning rather than disclosing the answer;
- compare conceptual changes, not merely lexical overlap, during repair verification.

The system must not present the diagnosis as a medical, psychological, or permanent assessment of the learner.

## 8. State and Data Flow

The client state machine is:

```text
material
  -> challenge
  -> first_explanation
  -> diagnosis_and_probe
  -> revised_explanation
  -> repair_result
```

Each transition requires validated data from the prior state. The current session is serialized to `localStorage` after each successful transition. Starting a new lesson clears the previous session only after explicit confirmation.

Source files and extracted text are processed only for the active request and are not stored in a server database. The built-in lesson ships as application-owned sample content.

## 9. Error Handling and Safety

- Empty or very short source text produces an actionable inline validation message.
- Excessively long input is rejected with the accepted size and a suggestion to paste one chapter or section.
- A damaged or unsupported PDF redirects the user to paste extracted text; PDF failure never blocks the built-in lesson.
- Structured-output validation failure triggers one automatic retry with the validation error summarized to the model.
- An API timeout or rate-limit error preserves all student input and displays a retry action.
- A second model failure produces a concise error state without fabricating a diagnosis.
- The built-in lesson may use a tested cached response only as an explicit demo fallback; normal operation calls GPT-5.6 live. The README documents this behavior.
- Source excerpts shown as evidence are verified against the normalized source text before rendering.
- Content from study materials is delimited and treated as data to reduce prompt-injection risk.

## 10. Testing Strategy

### Unit and Schema Tests

- Validate request and response schemas for all four AI operations.
- Test state-machine transition guards.
- Verify evidence excerpts occur in the normalized source text.
- Test status mapping and Before/After rendering.

### API Tests

- Mock valid, invalid, incomplete, timed-out, and rate-limited GPT-5.6 responses.
- Verify exactly one retry occurs after a structured-output failure.
- Verify the API key is never returned to the client.
- Verify untrusted material cannot override system instructions in representative prompt-injection fixtures.

### Product Tests

- Complete the built-in lesson with three answer fixtures: correct, partially incomplete, and clearly mistaken.
- Verify back navigation and browser refresh preserve progress.
- Verify a failed API call preserves the student's text.
- Run the complete happy path in a deployed production build.
- Confirm desktop presentation quality and basic responsive usability.

## 11. Three-Minute Demo Narrative

### 0:00–0:18 — Problem

“Students can get quiz questions right while still carrying the wrong mental model. Recall makes that hidden misunderstanding visible.”

### 0:18–0:38 — Start

Open the built-in statistics lesson and explain that a judge can test the product without setup or an account.

### 0:38–1:05 — First Explanation

Enter a plausible misconception: “If two variables consistently move together, one probably causes the other.” Select **Reveal my blind spot**.

### 1:05–1:45 — Core Reveal

Show the reasoning map. The observation that variables move together is supported, while the inference from correlation to direct causation is flagged. Show the source evidence and the generated ice-cream-sales-versus-drownings challenge.

### 1:45–2:15 — Repair

Identify temperature as a confounder, then revise the explanation to include confounding and reverse causality.

### 2:15–2:35 — Outcome

Show the misconception node changing to green and the Before/After reasoning comparison. State that Recall verifies a change in understanding rather than merely supplying an answer.

### 2:35–3:00 — Technical Implementation

Explain specifically how Codex accelerated the product architecture, structured-output contracts, UI, and failure testing. Explain that GPT-5.6 performs source-grounded misconception diagnosis, counterexample generation, and conceptual comparison between the two explanations.

Closing line:

> Recall doesn't replace thinking. It shows students where their thinking breaks—and helps them repair it.

## 12. Submission and Compliance

The submission must include:

- a working deployed URL with the built-in lesson;
- a public repository, or a private repository shared with the two judging addresses listed by the competition;
- setup instructions and sample data in the README;
- a public YouTube demo no longer than three minutes with narration;
- a description of how Codex and GPT-5.6 were used;
- the `/feedback` Codex Session ID from the primary build thread;
- the Education track selection.

The README must also disclose the cached demo fallback, document required environment variables, provide one-command local setup, and explain how judges can reproduce the live GPT-5.6 path.

## 13. Acceptance Criteria

The MVP is ready for submission only when all of the following are true:

1. A new judge can start the built-in lesson without an account or API key.
2. The four-stage Guided Focus flow completes successfully in the deployed application.
3. The diagnosis produces three to five typed reasoning nodes with verified source evidence.
4. The challenge targets the selected misconception without revealing a complete answer.
5. Repair verification visibly compares the original and revised explanations.
6. Invalid model output, API failure, and browser refresh do not erase the student's work.
7. Automated tests cover schemas, state transitions, evidence verification, retry behavior, and the built-in lesson fixtures.
8. The README and demo explicitly describe the distinct roles of Codex and GPT-5.6.
9. A full demo rehearsal finishes within three minutes.
10. The production URL, repository, video, session ID, and English submission copy are ready before the competition deadline.

## 14. Source References

- OpenAI Build Week overview and judging criteria: https://openai.devpost.com/
- Official rules: https://openai.devpost.com/rules
- Submission FAQ: https://openai.devpost.com/details/faqs
- OpenAI learning-outcomes research: https://openai.com/index/understanding-ai-and-learning-outcomes/
- UNESCO 2026 education prize theme on critical thinking with AI: https://www.unesco.org/en/articles/unesco-ict-education-prize-call-nominations-open-projects-supporting-learners-expand-creativity
