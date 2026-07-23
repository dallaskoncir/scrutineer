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
  assert.match(output, /SCRUTINEER_MODEL_OPENAI/);
  assert.match(output, /SCRUTINEER_MODEL_GEMINI/);
});

test("scrutineer review --provider accepts openai and gemini", () => {
  const output = execFileSync(
    process.execPath,
    ["--import", "tsx", "src/index.ts", "review", "--help"],
    { cwd: repoRoot, encoding: "utf-8" },
  );

  assert.match(output, /"openai"/);
  assert.match(output, /"gemini"/);
});

test("scrutineer review --help documents --diff", () => {
  const output = execFileSync(
    process.execPath,
    ["--import", "tsx", "src/index.ts", "review", "--help"],
    { cwd: repoRoot, encoding: "utf-8" },
  );

  assert.match(output, /--diff <target>/);
});

test("scrutineer review --help documents -m, --model", () => {
  const output = execFileSync(
    process.execPath,
    ["--import", "tsx", "src/index.ts", "review", "--help"],
    { cwd: repoRoot, encoding: "utf-8" },
  );

  assert.match(output, /-m, --model <name>/);
});

function runReview(
  args: string[],
  options: { env?: NodeJS.ProcessEnv; timeoutMs?: number } = {},
): { status: number | null; stdout: string; stderr: string; timedOut: boolean } {
  try {
    const stdout = execFileSync(process.execPath, ["--import", "tsx", "src/index.ts", "review", ...args], {
      cwd: repoRoot,
      encoding: "utf-8",
      env: { ...process.env, ...options.env },
      timeout: options.timeoutMs,
    });
    return { status: 0, stdout, stderr: "", timedOut: false };
  } catch (error) {
    const e = error as { status: number | null; stdout: string; stderr: string; signal?: string | null };
    // execFileSync's `timeout` option kills the child (default signal SIGTERM) and
    // throws instead of returning a normal exit code, so a timed-out run must be
    // told apart from a real, prompt failure — otherwise a regression of the hang
    // this test guards against would just look like "no assertions ran yet".
    return { status: e.status, stdout: e.stdout, stderr: e.stderr, timedOut: e.signal === "SIGTERM" };
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

test("scrutineer review --diff <bad-ref> fails with a friendly message, not a raw git stack trace", () => {
  const { status, stderr } = runReview(["--diff", "not-a-real-ref-hopefully"]);
  assert.equal(status, 1);
  assert.match(stderr, /could not diff against "not-a-real-ref-hopefully"/);
  assert.doesNotMatch(stderr, /at Object/); // no raw Node/git stack trace leaking through
});

test("scrutineer review --diff <target starting with '-'> is rejected before it reaches git", () => {
  const { status, stderr } = runReview(["--diff", "--output=/tmp/scrutineer-should-not-exist.txt"]);
  assert.equal(status, 1);
  assert.match(stderr, /not a valid git ref/);
});

test("scrutineer review exits promptly instead of hanging when the review pipeline itself fails (GH #28)", () => {
  // Points at a closed local port so the failure is a real async rejection from
  // inside the AI SDK's generateText call (not an early, pre-pipeline validation
  // error), fully offline and near-instant — this is what actually exercises the
  // bug: clack's `tasks()` helper leaks its spinner's setInterval when a task
  // rejects, which previously kept the process alive indefinitely after this
  // exact kind of failure. A bounded execFileSync timeout means a regression
  // fails this test instead of hanging the whole suite.
  const { status, stdout, timedOut } = runReview(
    ["src/services/skill-router.ts", "--provider", "ollama"],
    { env: { OLLAMA_HOST: "http://127.0.0.1:1" }, timeoutMs: 30_000 },
  );
  assert.equal(timedOut, false, "process should exit on its own instead of being killed by the test timeout");
  assert.equal(status, 1);
  assert.match(stdout, /Review failed/);
});
