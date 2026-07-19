# RecallMap Demo Video Design

**Date:** 2026-07-19

## Goal

Produce a clear English-language competition demo that shows RecallMap's core
learning loop, explains the role of Codex and the runtime provider truthfully,
and remains safely below the three-minute limit.

## Format

- Target duration: 2:45 to 2:50; hard maximum: 3:00.
- Resolution: 1920×1080, 16:9.
- Narration: the entrant's own English voice.
- Production: separately recorded real product clips, edited into one concise
  walkthrough, with English subtitles.
- Remove live-model waiting time during editing. Show the caption
  `Live analysis — wait removed` at the cut so the edit remains transparent.

## Story

The video must distinguish RecallMap from a generic answer-generating tutor.
Its central claim is that RecallMap turns a student's explanation into a
source-grounded reasoning map, identifies the highest-priority reasoning gap,
asks one targeted challenge, and verifies whether the student's revision
repairs that gap.

## Timeline

1. **0:00–0:15 — Hook:** show the RecallMap start screen and state the hidden
   misconception problem.
2. **0:15–0:35 — Start:** launch the built-in sample lesson without an account
   or personal API key.
3. **0:35–0:55 — Teach back:** enter a plausible but incorrect causal
   explanation and select **Reveal my blind spot**.
4. **0:55–1:30 — Diagnose:** show the reasoning map, source evidence, priority
   gap, and targeted question.
5. **1:30–1:55 — Repair:** enter the tested revised explanation in the
   student's own words.
6. **1:55–2:20 — Verify:** show the repaired node and Before/After comparison.
7. **2:20–2:40 — Build disclosure:** briefly show the public GitHub repository
   and test evidence while explaining the Codex and provider roles.
8. **2:40–2:50 — Close:** end on one memorable product sentence.

Do not spend a separate segment demonstrating retry behavior; prioritize the
reasoning map, targeted repair, and visible conceptual change.

## Technical Disclosure

The narration must remain factual:

- the selected server provider performs runtime learning analysis;
- the current public deployment uses Xiaomi MiMo V2.5 through an
  OpenAI-compatible Responses API;
- the code supports GPT-5.6 through the OpenAI Responses API when
  `OPENAI_API_KEY` is configured, with OpenAI taking priority when both keys
  exist; and
- Codex was used for research, design, implementation, testing, review, and
  deployment, but is not the runtime tutor.

Do not claim that the public deployment currently runs GPT-5.6, and do not
claim an unrecorded live browser validation.

## Recording Safety

- Hide API keys, Azure account details, personal email addresses, browser
  bookmarks, notifications, and unrelated tabs.
- Record only the public application and public GitHub repository.
- Use prepared, tested student answers to reduce typing errors.
- If a live request fails, stop that take and use a previously recorded
  successful real take; do not fabricate a result.
- Keep the provider label visible when practical.

## Deliverables

The recording package will contain:

1. an English narration script that can be read verbatim;
2. a timestamped shot and interaction list;
3. the exact first and revised explanations to paste; and
4. a recording, editing, privacy, and upload checklist.

## Acceptance Criteria

- The final video is no longer than 3:00.
- RecallMap and its core value appear within the first 15 seconds.
- The reasoning map appears within the first minute.
- The repaired Before/After result appears by 2:20.
- The voice is intelligible and subtitles match the narration.
- The Codex, MiMo V2.5, and optional GPT-5.6 roles are described accurately.
- No credential or personal account information is visible or audible.
