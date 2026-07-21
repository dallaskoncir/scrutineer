import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { scrubSecrets } from "./secret-scrubber.js";

const CHANGED_FILE_EXTENSIONS = [".ts", ".tsx"];

function runGitDiff(args: string[], cwd?: string): string {
  return execFileSync("git", args, { encoding: "utf-8", cwd });
}

function withSecretsScrubbed(content: string): string {
  const { scrubbed, redactedCount } = scrubSecrets(content);
  if (redactedCount > 0) {
    console.error(
      `scrutineer: redacted ${redactedCount} value(s) that looked like secrets before sending to the review model`,
    );
  }
  return scrubbed;
}

// Ref is passed as an argv element via execFileSync (never through a shell), so a
// hostile or malformed --diff target can't inject shell commands — the worst it can
// do is fail as an invalid git ref, which is handled below.
export function getChangedFiles(target: string, cwd?: string): string[] {
  let output: string;
  try {
    output = runGitDiff(["diff", "--name-only", `${target}...HEAD`], cwd);
  } catch (error) {
    const stderr =
      error && typeof error === "object" && "stderr" in error ? String(error.stderr).trim() : "";
    throw new Error(
      `scrutineer: could not diff against "${target}" — make sure it's a valid, reachable git ref ` +
        `(branch, tag, or commit), e.g. --diff origin/main.` +
        (stderr ? `\n${stderr}` : ""),
      { cause: error },
    );
  }
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && CHANGED_FILE_EXTENSIONS.some((ext) => line.endsWith(ext)));
}

export function getDiffAgainstTarget(target: string, filePaths: string[], cwd?: string): string {
  const diff = runGitDiff(["diff", "--no-color", `${target}...HEAD`, "--", ...filePaths], cwd);
  return withSecretsScrubbed(diff);
}

export function getFileDiff(filePath: string): string {
  try {
    const workingTreeDiff = runGitDiff(["diff", "--no-color", "--", filePath]);
    if (workingTreeDiff.trim().length > 0) {
      return withSecretsScrubbed(workingTreeDiff);
    }

    const stagedDiff = runGitDiff(["diff", "--no-color", "--cached", "--", filePath]);
    if (stagedDiff.trim().length > 0) {
      return withSecretsScrubbed(stagedDiff);
    }
  } catch {
    // Not a git repo, git unavailable, or the file isn't tracked — fall through.
  }

  const fileContents = readFileSync(filePath, "utf-8");
  return withSecretsScrubbed(
    `(no uncommitted changes detected; showing full file contents)\n\n${fileContents}`,
  );
}
