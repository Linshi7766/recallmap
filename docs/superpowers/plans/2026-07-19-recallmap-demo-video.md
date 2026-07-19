# RecallMap Bilingual Demo Package Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce a ready-to-record bilingual RecallMap competition video package with English narration, Chinese reference translation, exact demo inputs, a timestamped shot list, and recording/upload checks.

**Architecture:** Keep spoken copy in `docs/demo-script.md` and operational recording instructions in a separate `docs/demo-recording-guide.md`. Add repository-hygiene tests that enforce the bilingual structure, exact tested inputs, truthful provider disclosure, and the under-three-minute narration budget.

**Tech Stack:** Markdown, Vitest, Node.js text parsing

## Global Constraints

- Target duration is 2:45 to 2:50; the hard maximum is 3:00.
- The final video uses the entrant's own English voice and English subtitles.
- Every English narration passage is followed by a faithful Chinese reference translation that is not spoken or counted in the runtime.
- Use separately recorded real product clips and show `Live analysis — wait removed` where live-model waiting is cut.
- Prioritize the reasoning map, priority gap, targeted repair, and Before/After verification; do not allocate a separate retry-demo segment.
- Describe provider roles truthfully: current public deployment MiMo V2.5, optional prioritized GPT-5.6 support, and Codex as the development tool rather than runtime tutor.
- Do not expose credentials, Azure account information, personal email, browser bookmarks, notifications, or unrelated tabs.
- Do not modify product code or `进度管理/`.

---

### Task 1: Lock the bilingual demo-package contract

**Files:**
- Modify: `tests/repository/hygiene.test.ts`
- Test: `tests/repository/hygiene.test.ts`

**Interfaces:**
- Consumes: `docs/demo-script.md`, `docs/demo-recording-guide.md`, and the tested sample-answer constants.
- Produces: regression checks for script structure, narration budget, exact paste text, and disclosure truthfulness.

- [ ] **Step 1: Add a failing repository test**

Add one test named `keeps the bilingual demo package ready to record`. It must:

```ts
const demoScript = readFileSync("docs/demo-script.md", "utf8");
const recordingGuide = readFileSync("docs/demo-recording-guide.md", "utf8");
const englishSections = [
  ...demoScript.matchAll(
    /\*\*English narration\*\*\s*\n\n([\s\S]*?)\n\n\*\*中文对照\*\*/g,
  ),
].map((match) => match[1]!.trim());
const englishWordCount = englishSections
  .join(" ")
  .split(/\s+/)
  .filter(Boolean).length;

expect(englishSections).toHaveLength(8);
expect(englishWordCount).toBeGreaterThanOrEqual(260);
expect(englishWordCount).toBeLessThanOrEqual(330);
expect(demoScript.match(/\*\*中文对照\*\*/g)).toHaveLength(8);
expect(demoScript).toContain("Live analysis — wait removed");
expect(demoScript).toContain(
  "The current public deployment uses Xiaomi MiMo V2.5 through an OpenAI-compatible Responses API.",
);
expect(demoScript).toContain(
  "GPT-5.6 is supported through the OpenAI Responses API when `OPENAI_API_KEY` is configured",
);
expect(demoScript).toContain("Codex was the development tool, not the runtime tutor.");
expect(recordingGuide).toContain(
  "If two variables consistently move together, one probably causes the other unless the data has an error.",
);
expect(recordingGuide).toContain(
  "Correlation shows that variables move together, but it does not reveal why.",
);
expect(recordingGuide).toContain("1920×1080");
expect(recordingGuide).toContain("No API keys, Azure account details, or personal email");
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- tests/repository/hygiene.test.ts -t "keeps the bilingual demo package"`

Expected: FAIL because the existing script is not bilingual and the recording guide does not exist.

### Task 2: Write the bilingual narration and recording guide

**Files:**
- Modify: `docs/demo-script.md`
- Create: `docs/demo-recording-guide.md`
- Test: `tests/repository/hygiene.test.ts`

**Interfaces:**
- Consumes: the exact test contract from Task 1 and `DEMO_FIRST_EXPLANATION` / `DEMO_REVISED_EXPLANATION` from `src/lib/domain/sample-lesson.ts`.
- Produces: a script the entrant can read verbatim and a shot-by-shot operating guide.

- [ ] **Step 1: Rewrite the narration into eight bilingual sections**

Use these exact section titles and ranges:

```markdown
## 0:00–0:15 — The hidden problem / 隐藏的问题
## 0:15–0:35 — Start without friction / 无门槛开始
## 0:35–0:55 — Expose the reasoning / 暴露推理过程
## 0:55–1:30 — Reveal the priority gap / 找出关键断点
## 1:30–1:55 — Repair in the student's words / 用学生自己的话修复
## 1:55–2:20 — Make the change visible / 让理解变化可见
## 2:20–2:40 — Technology and disclosure / 技术与披露
## 2:40–2:50 — Close / 收尾
```

Under every heading, use the bold labels `**Screen / 画面**`,
`**English narration**`, and `**中文对照**` in that order. The screen block
contains the concrete action for that timestamp, the English block contains
the final words the entrant reads aloud, and the Chinese block contains a
faithful line-matched reference translation of that English passage.

The English passages must total 260–330 whitespace-delimited words. The first minute must explain that students can hold a wrong mental model despite recognizing an answer, then show RecallMap converting the explanation into a source-grounded reasoning map. The diagnosis passage must name the supported association, causal leap, source evidence, priority gap, and one focused question. The verification passage must explain that Before/After demonstrates conceptual change rather than answer delivery. The technology passage must include all three exact provider/Codex disclosures asserted in Task 1 without claiming a live GPT-5.6 public run.

- [ ] **Step 2: Create the operational recording guide**

Create `docs/demo-recording-guide.md` with these sections:

```markdown
# RecallMap demo recording guide / RecallMap 演示录制指南
## Before recording / 录制前
## Exact paste text / 精确粘贴文本
### First explanation / 第一次解释
### Revised explanation / 修订后的解释
## Shot list / 分镜操作表
## Editing workflow / 剪辑流程
## Privacy and accuracy check / 隐私与准确性检查
## Export and upload check / 导出与上传检查
```

The two paste blocks must exactly equal:

```text
If two variables consistently move together, one probably causes the other unless the data has an error.
```

```text
Correlation shows that variables move together, but it does not reveal why. The association may come from direct causation, reverse causation, a common cause such as temperature, selection bias, or chance, so additional evidence is required.
```

The shot list must map all eight script ranges to exact browser actions. The guide must specify 1920×1080, 16:9, browser zoom around 110–125%, English subtitles, separate voice recording, the transparent wait-removal caption, and the literal privacy checkpoint `No API keys, Azure account details, or personal email`.

- [ ] **Step 3: Run focused GREEN verification**

Run: `npm test -- tests/repository/hygiene.test.ts`

Expected: all repository-hygiene tests pass, including eight bilingual sections and an English word count between 260 and 330.

- [ ] **Step 4: Manually verify the narration count and timeline**

Run:

```powershell
$text = Get-Content -Raw -Encoding utf8 -LiteralPath 'docs\demo-script.md'
$sections = [regex]::Matches($text, '\*\*English narration\*\*\s*\r?\n\r?\n([\s\S]*?)\r?\n\r?\n\*\*中文对照\*\*')
$spoken = ($sections | ForEach-Object { $_.Groups[1].Value.Trim() }) -join ' '
"SECTIONS=$($sections.Count) WORDS=$(($spoken -split '\s+' | Where-Object { $_ }).Count)"
```

Expected: `SECTIONS=8` and `WORDS` between 260 and 330. Confirm the last timestamp is `2:50`, leaving ten seconds below the hard limit.

- [ ] **Step 5: Run the full test suite**

Run: `npm test`

Expected: all tests pass.

- [ ] **Step 6: Commit the recording package**

```powershell
git add -- docs/demo-script.md docs/demo-recording-guide.md tests/repository/hygiene.test.ts
git commit -m "docs: prepare bilingual RecallMap demo"
```

### Task 3: Publish the documentation update

**Files:**
- Verify only: the committed demo package.

**Interfaces:**
- Consumes: the verified Task 2 commit.
- Produces: the bilingual recording package on the public GitHub `master` branch.

- [ ] **Step 1: Verify scope and repository state**

Run: `git diff --check HEAD~1..HEAD` and `git status --short`.

Expected: no whitespace errors; only the user's existing `进度管理/` directory remains untracked.

- [ ] **Step 2: Push master**

Run: `git -c http.version=HTTP/1.1 push origin master`

Expected: GitHub updates `Linshi7766/recallmap` to the bilingual demo-package commit.
