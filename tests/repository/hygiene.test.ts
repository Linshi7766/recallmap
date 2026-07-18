import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

it("keeps the generated Next type shim ignored and untracked", () => {
  const ignoreRules = readFileSync(".gitignore", "utf8").split(/\r?\n/);
  const trackedShim = execFileSync("git", ["ls-files", "next-env.d.ts"], {
    encoding: "utf8",
  }).trim();

  expect(ignoreRules).toContain("/next-env.d.ts");
  expect(trackedShim).toBe("");
});

it("keeps isolated worktrees out of repository-wide lint", () => {
  const eslintConfig = readFileSync("eslint.config.mjs", "utf8");

  expect(eslintConfig).toContain('".worktrees/**"');
});

it("documents both server-only provider keys without values", () => {
  const example = readFileSync(".env.example", "utf8").replace(/\r\n/g, "\n");
  const readme = readFileSync("README.md", "utf8");

  expect(example).toBe("OPENAI_API_KEY=\nMIMO_API_KEY=\n");
  expect(readme).toContain("mimo-v2.5");
  expect(readme).toContain("OpenAI takes priority when both keys are set");
  expect(readme).not.toMatch(/(?:OPENAI|MIMO)_API_KEY=\S+/);
});

it("describes generic live analysis through the selected provider", () => {
  const readme = readFileSync("README.md", "utf8");

  expect(readme).toContain("server-only selected live provider gateway");
  expect(readme).toContain("dispatches four focused selected-provider calls");
  expect(readme).toContain("RecallMap attempts the selected live provider first");
  expect(readme).toContain("RecallMap is an educational aid");
  expect(readme).toContain("never calls a real provider API");
  expect(readme).not.toContain("server-only GPT-5.6 gateway");
  expect(readme).not.toContain("dispatches four focused GPT-5.6 calls");
  expect(readme).not.toContain("RecallMap attempts live `gpt-5.6` first");
  expect(readme).not.toContain("Recall is an educational aid");
  expect(readme).not.toContain("never calls the real OpenAI API");
});

it("distinguishes OpenAI strict schema enforcement from MiMo local validation", () => {
  const readme = readFileSync("README.md", "utf8");

  expect(readme).toContain("server-enforced strict JSON Schema");
  expect(readme).toContain("MiMo uses JSON object mode");
  expect(readme).toContain("raw `output_text` is parsed as JSON");
  expect(readme).toContain("validated locally with the same Zod and domain checks");
  expect(readme).toContain(
    "The current public deployment uses Xiaomi MiMo V2.5 through an OpenAI-compatible Responses API.",
  );
  expect(readme).toContain(
    "Controlled non-demo MiMo production HTTP acceptance passed on 2026-07-18 with `fallback=false`.",
  );
  expect(readme).not.toMatch(/Live non-demo MiMo acceptance is still pending/i);
});

it("truthfully discloses the current and supported runtime providers", () => {
  const readme = readFileSync("README.md", "utf8");
  const demoScript = readFileSync("docs/demo-script.md", "utf8");

  for (const publicSurface of [readme, demoScript]) {
    expect(publicSurface).toContain(
      "The selected server provider performs the runtime analysis.",
    );
    expect(publicSurface).toContain(
      "The current public deployment uses Xiaomi MiMo V2.5 through an OpenAI-compatible Responses API.",
    );
    expect(publicSurface).toContain(
      "GPT-5.6 is supported through the OpenAI Responses API when `OPENAI_API_KEY` is configured, and OpenAI takes priority when both keys exist.",
    );
    expect(publicSurface).toContain(
      "Controlled non-demo MiMo production HTTP acceptance passed on 2026-07-18 with `fallback=false`.",
    );
    expect(publicSurface).toContain(
      "Codex was the development tool, not the runtime tutor.",
    );
    expect(publicSurface).not.toMatch(/MiMo acceptance is still pending/i);
  }
});

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
