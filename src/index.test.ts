import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("scrutineer review --help documents the SCRUTINEER_MODEL_* env vars", () => {
  const output = execFileSync(
    process.execPath,
    ["--import", "tsx", "src/index.ts", "review", "--help"],
    { cwd: repoRoot, encoding: "utf-8" },
  );

  assert.match(output, /SCRUTINEER_MODEL_ANTHROPIC/);
  assert.match(output, /SCRUTINEER_MODEL_OLLAMA/);
});

test("scrutineer review --help documents --diff", () => {
  const output = execFileSync(
    process.execPath,
    ["--import", "tsx", "src/index.ts", "review", "--help"],
    { cwd: repoRoot, encoding: "utf-8" },
  );

  assert.match(output, /--diff <target>/);
});

function runReview(args: string[]): { status: number | null; stderr: string } {
  try {
    execFileSync(process.execPath, ["--import", "tsx", "src/index.ts", "review", ...args], {
      cwd: repoRoot,
      encoding: "utf-8",
    });
    return { status: 0, stderr: "" };
  } catch (error) {
    const e = error as { status: number | null; stderr: string };
    return { status: e.status, stderr: e.stderr };
  }
}

test("scrutineer review fails with a friendly message when neither a file nor --diff is given", () => {
  const { status, stderr } = runReview([]);
  assert.equal(status, 1);
  assert.match(stderr, /provide a file path or --diff <target>/);
});

test("scrutineer review fails with a friendly message when both a file and --diff are given", () => {
  const { status, stderr } = runReview(["src/index.ts", "--diff", "main"]);
  assert.equal(status, 1);
  assert.match(stderr, /pass either a file path or --diff <target>, not both/);
});
