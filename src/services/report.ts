import type { ReviewResult } from "./ai-orchestrator.js";
import type { ProviderId } from "../utils/model-factory.js";

export interface ReportInput {
  filePath: string;
  provider: ProviderId;
  result: ReviewResult;
  generatedAt?: Date;
}

export function buildReportMarkdown(input: ReportInput): string {
  const { filePath, provider, result, generatedAt = new Date() } = input;
  const { codeReview, securityAudit, sandboxTest } = result;
  const sandboxStatus = sandboxTest.result.ok ? "PASS" : "FAILED";

  const sections = [
    "# Slipstream Review Report",
    "",
    `- **File:** \`${filePath}\``,
    `- **Provider:** ${provider}`,
    `- **Generated:** ${generatedAt.toISOString()}`,
    "",
    "## Code Review",
    "",
    codeReview,
    "",
    "## Security Audit",
    "",
    securityAudit,
    "",
    "## Sandbox Test",
    "",
    `**Result:** ${sandboxStatus}`,
    "",
    "```js",
    sandboxTest.code,
    "```",
  ];

  if (sandboxTest.result.logs.length > 0) {
    sections.push("", "**Logs:**", "");
    sections.push(...sandboxTest.result.logs.map((line) => `- ${line}`));
  }

  if (sandboxTest.result.errors.length > 0) {
    sections.push("", "**Errors:**", "");
    sections.push(...sandboxTest.result.errors.map((line) => `- ${line}`));
  }

  return sections.join("\n");
}
