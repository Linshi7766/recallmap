# RecallMap Brand Rename Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename the product's current public-facing brand from Recall to RecallMap without changing domain terminology, persistence, APIs, or historical records.

**Architecture:** Treat the rename as presentation and publication metadata only. Update tested UI strings first, then current repository and submission copy; preserve internal identifiers and the `Recall card` feature term.

**Tech Stack:** Next.js 15, React 19, TypeScript, Vitest, Testing Library, npm

## Global Constraints

- Use **RecallMap** for current public product branding.
- Use the tagline `Teach it back. RecallMap finds the hidden gap.`
- Preserve `RecallApp`, `src/components/recall`, `recall.session.v1`, API schema names, `recallCard`, and the displayed term **Recall card**.
- Do not rename the deployment hostname, systemd service, or historical design and implementation documents.
- Do not stage or modify `进度管理/`.

---

## File Structure

- `src/app/layout.tsx`: browser metadata.
- `src/components/recall/recall-app.tsx`: persistent header brand.
- `src/components/recall/start-stage.tsx`: home-page tagline.
- `src/components/recall/teachback-stage.tsx`: product name in guided-flow copy.
- `tests/components/recall-app.test.tsx`: public UI branding regression coverage.
- `README.md`: current public project overview and operating documentation.
- `docs/demo-script.md`: narrated competition demo copy.
- `docs/submission-checklist.md`: current submission asset title.
- `package.json` and `package-lock.json`: npm package identity.
- `tests/repository/hygiene.test.ts`: current public documentation and package branding checks.

### Task 1: Rename the tested application surfaces

**Files:**
- Modify: `tests/components/recall-app.test.tsx`
- Modify: `src/app/layout.tsx`
- Modify: `src/components/recall/recall-app.tsx`
- Modify: `src/components/recall/start-stage.tsx`
- Modify: `src/components/recall/teachback-stage.tsx`

**Interfaces:**
- Consumes: existing `Page` and `RecallApp` render paths.
- Produces: visible `RECALLMAP` header, RecallMap tagline and teach-back copy, and `RecallMap` browser title.

- [ ] **Step 1: Add failing UI and metadata assertions**

Import the layout metadata and change the introductory test to require the new public brand:

```tsx
import { metadata } from "@/app/layout";

it("introduces RecallMap as a guided misconception detector", async () => {
  vi.stubGlobal("fetch", vi.fn());
  render(<Page />);

  expect(metadata.title).toBe("RecallMap");
  expect(screen.getByText("RECALLMAP")).toBeVisible();
  expect(
    screen.getByText("Teach it back. RecallMap finds the hidden gap."),
  ).toBeVisible();
  expect(screen.queryByText(/^RECALL$/)).not.toBeInTheDocument();
});
```

Keep the test's existing focus, accessibility, start-button, and privacy assertions after these brand assertions.

- [ ] **Step 2: Run the focused test and verify the new assertions fail**

Run: `npm test -- tests/components/recall-app.test.tsx -t "introduces RecallMap"`

Expected: FAIL because the metadata, header, and tagline still say Recall.

- [ ] **Step 3: Apply the minimal public UI rename**

Use these exact public strings:

```tsx
// src/app/layout.tsx
title: "RecallMap",

// src/components/recall/recall-app.tsx
<span className="brand">RECALLMAP</span>

// src/components/recall/start-stage.tsx
<p className="lede">Teach it back. RecallMap finds the hidden gap.</p>

// src/components/recall/teachback-stage.tsx
Explain it in your own words. RecallMap will look at the reasoning, not
polish or vocabulary.
```

- [ ] **Step 4: Run the focused component suite**

Run: `npm test -- tests/components/recall-app.test.tsx`

Expected: the component test file passes.

- [ ] **Step 5: Commit the application branding**

```powershell
git add -- src/app/layout.tsx src/components/recall/recall-app.tsx src/components/recall/start-stage.tsx src/components/recall/teachback-stage.tsx tests/components/recall-app.test.tsx
git commit -m "feat: rename product UI to RecallMap"
```

### Task 2: Rename current public repository and submission copy

**Files:**
- Modify: `tests/repository/hygiene.test.ts`
- Modify: `README.md`
- Modify: `docs/demo-script.md`
- Modify: `docs/submission-checklist.md`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Consumes: the RecallMap public brand established by Task 1.
- Produces: consistent GitHub, npm metadata, demo narration, and Devpost preparation copy.

- [ ] **Step 1: Add a failing repository-branding test**

Append this test to `tests/repository/hygiene.test.ts`:

```ts
it("uses RecallMap across current public project surfaces", () => {
  const readme = readFileSync("README.md", "utf8");
  const demoScript = readFileSync("docs/demo-script.md", "utf8");
  const submissionChecklist = readFileSync(
    "docs/submission-checklist.md",
    "utf8",
  );
  const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
  const packageLock = JSON.parse(readFileSync("package-lock.json", "utf8"));

  expect(readme).toMatch(/^# RecallMap$/m);
  expect(demoScript).toMatch(/^# RecallMap three-minute demo script$/m);
  expect(submissionChecklist).toMatch(/^# RecallMap submission checklist$/m);
  expect(packageJson.name).toBe("recallmap");
  expect(packageJson.description).toBe("RecallMap misconception detector");
  expect(packageLock.name).toBe("recallmap");
  expect(packageLock.packages[""].name).toBe("recallmap");
});
```

- [ ] **Step 2: Run the repository test and verify it fails**

Run: `npm test -- tests/repository/hygiene.test.ts -t "uses RecallMap"`

Expected: FAIL on the current Recall headings and `recall-build` package name.

- [ ] **Step 3: Update current public documentation and package metadata**

Make these exact identity changes:

```json
// package.json and both package-lock.json name fields
"name": "recallmap"

// package.json
"description": "RecallMap misconception detector"
```

Change the three current document headings to:

```markdown
# RecallMap
# RecallMap three-minute demo script
# RecallMap submission checklist
```

Within `README.md` and `docs/demo-script.md`, replace uses of **Recall** that name the product with **RecallMap**. Preserve common/domain uses such as **recall card**, and do not modify files under `docs/superpowers/specs` or `docs/superpowers/plans` other than this plan.

- [ ] **Step 4: Update the existing README provider assertion**

Change the product-name assertion in `tests/repository/hygiene.test.ts` to:

```ts
expect(readme).toContain("RecallMap attempts the selected live provider first");
expect(readme).not.toContain("RecallMap attempts live `gpt-5.6` first");
```

- [ ] **Step 5: Run repository and component regression tests**

Run: `npm test -- tests/repository/hygiene.test.ts tests/components/recall-app.test.tsx`

Expected: both test files pass.

- [ ] **Step 6: Commit current public copy and metadata**

```powershell
git add -- README.md docs/demo-script.md docs/submission-checklist.md package.json package-lock.json tests/repository/hygiene.test.ts
git commit -m "docs: align public copy with RecallMap"
```

### Task 3: Verify and publish the completed rename

**Files:**
- Verify only: all tracked project files.

**Interfaces:**
- Consumes: Tasks 1 and 2.
- Produces: a tested, buildable public revision on `origin/master`.

- [ ] **Step 1: Check scope and formatting**

Run: `git status --short` and `git diff --check HEAD~2..HEAD`

Expected: only `进度管理/` remains untracked; no whitespace errors are reported.

- [ ] **Step 2: Run the complete automated test suite**

Run: `npm test`

Expected: all test files and tests pass.

- [ ] **Step 3: Run lint and production build**

Run: `npm run lint`

Expected: exit code 0.

Run: `npm run build`

Expected: Next.js production build exits with code 0.

- [ ] **Step 4: Confirm preserved identifiers**

Run:

```powershell
Select-String -Path 'src/hooks/use-learning-session.ts','src/lib/ai/operations.ts','src/components/recall/result-stage.tsx' -Pattern 'recall.session.v1|recall_diagnosis|Recall card'
```

Expected: all three preserved identifiers are still present.

- [ ] **Step 5: Push the verified commits**

Run: `git -c http.version=HTTP/1.1 push origin master`

Expected: GitHub accepts the new commits on `Linshi7766/recallmap`.
