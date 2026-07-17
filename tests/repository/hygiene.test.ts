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
