import { checkEvidence, normalizeEvidence } from "./evidence.js";

export function renderMarkdown(evidence) {
  const data = normalizeEvidence(evidence);
  const check = checkEvidence(data);
  const lines = [
    "# PR Evidence Pack",
    "",
    "## Summary",
    ...(data.summary.length ? data.summary.map((item) => `- ${item}`) : ["- No summary recorded."]),
    "",
    "## Git",
    `- Branch: ${data.git.branch ?? "unknown"}`,
    `- Head: ${data.git.head ?? "unknown"}`,
    `- Base: ${data.git.base ?? "unknown"}`,
    `- Dirty: ${data.git.dirty ? "yes" : "no"}`,
    "",
    "### Commits",
    ...(data.git.commits?.length ? data.git.commits.map((item) => `- ${item}`) : ["- None recorded."]),
    "",
    "### Changed Files",
    ...(data.git.changedFiles?.length ? data.git.changedFiles.map((item) => `- ${item}`) : ["- None recorded."]),
    "",
    "## Verification",
    ...renderCommands(data.commands),
    "",
    "## Package Contents",
    ...(data.packageContents.length ? data.packageContents.map((item) => `- ${item}`) : ["- Not recorded."]),
    "",
    "## Residual Risks",
    ...(data.risks.length ? data.risks.map((item) => `- ${item}`) : ["- None recorded."]),
    "",
    "## Next Steps",
    ...(data.nextSteps.length ? data.nextSteps.map((item) => `- ${item}`) : ["- None recorded."]),
    "",
    "## Evidence Check",
    `Status: ${check.ok ? "pass" : "needs attention"}`,
    ...(check.findings.length ? check.findings.map((item) => `- ${item}`) : ["- Required evidence is present."])
  ];
  return `${lines.join("\n")}\n`;
}

export function renderJson(value) {
  return `${JSON.stringify(normalizeEvidence(value), null, 2)}\n`;
}

function renderCommands(commands) {
  if (commands.length === 0) return ["- No verification commands recorded."];
  return commands.map((command) => {
    const status = command.exitCode === 0 ? "pass" : "fail";
    const duration = command.durationMs === null ? "" : ` (${command.durationMs}ms)`;
    return `- \`${command.command}\`: ${status}${duration}${command.summary ? ` - ${command.summary}` : ""}`;
  });
}
