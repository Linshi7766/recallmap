# RecallMap three-minute demo script

Target length: 3:00. Spoken narration is 307 words; bracketed cues are visual directions, not narration.

### 0:00–0:18 — The hidden problem

[Open RecallMap on the start screen.]

“Students can recognize a correct answer while still carrying the wrong mental model. RecallMap makes that hidden misunderstanding visible, then asks the student to repair it in their own words.”

### 0:18–0:36 — Start without friction

[Select **Start sample lesson**.]

“A judge can start this built-in statistics lesson without a RecallMap account or personal API key. The lesson asks why ice-cream sales and drowning incidents can move together without one causing the other.”

### 0:36–0:58 — Expose the reasoning

[Enter the tested first explanation and select **Reveal my blind spot**.]

“I’ll give a plausible misconception: if two variables consistently move together, one probably causes the other unless the data has an error. RecallMap does not reward polished wording. It examines the reasoning against the supplied material.”

### 0:58–1:27 — Reveal the gap with evidence

[Pause on the reasoning map and priority node. Point to the evidence.]

“The map preserves what is supported: the variables move together. It flags the direct causal leap as the priority misconception and shows the source evidence: ‘Correlation alone does not identify the mechanism that produced an association.’ It then asks one focused question about hot weather affecting both ice-cream sales and drownings. It does not reveal a complete answer.”

### 1:27–1:44 — Show resilient retry

[Use the prepared one-time diagnosis failure take, then select **Retry analysis**.]

“If analysis is temporarily unavailable, the exact student explanation stays on screen. Retry continues from the same work instead of asking the student to reconstruct it.”

### 1:44–2:05 — Repair in the student's words

[Select **Work through this challenge** and enter the tested revision.]

“Now I identify temperature as a common cause and revise the explanation to include reverse causation, confounding, selection bias, chance, and the need for additional evidence.”

### 2:05–2:20 — Make the change visible

[Select **Check my repaired understanding**. Show the green repaired node and Before/After card.]

“The priority node turns supported, and Before/After shows the conceptual change. RecallMap verifies repaired reasoning instead of merely supplying an answer.”

### 2:20–2:50 — Explain the technology and disclosure

[Show the result, then briefly show the repository test/docs view.]

“At runtime, GPT-5.6 uses Responses API structured outputs for source-grounded misconception diagnosis, targeted counterexample challenge generation, and conceptual comparison between explanations. Codex researched constraints; designed the architecture, structured-output contracts, and UI; implemented the app; and tested failure recovery. It is not the runtime tutor. The exact built-in fallback runs only after an eligible live failure. Pasted material never falls back.”

### 2:50–3:00 — Close

RecallMap doesn't replace thinking. It shows students where their thinking breaks—and helps them repair it.
