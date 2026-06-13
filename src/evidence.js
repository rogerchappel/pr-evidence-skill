import { readFile } from "node:fs/promises";
import { collectGitEvidence } from "./git.js";

export async function readJson(filePath) {
  const raw = await readFile(filePath, "utf8");
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`Invalid JSON in ${filePath}: ${error.message}`);
  }
}

export async function collectEvidence(options = {}) {
  const commands = options.commands ? await readJson(options.commands) : [];
  const notes = options.notes ? await readJson(options.notes) : {};
  const git = await collectGitEvidence(options.cwd ?? process.cwd(), options.base ?? "HEAD~1");
  return normalizeEvidence({
    schemaVersion: 1,
    collectedAt: new Date().toISOString(),
    git,
    commands,
    summary: notes.summary ?? [],
    risks: notes.risks ?? [],
    nextSteps: notes.nextSteps ?? [],
    packageContents: notes.packageContents ?? []
  });
}

export function normalizeEvidence(evidence) {
  return {
    schemaVersion: evidence.schemaVersion ?? 1,
    collectedAt: evidence.collectedAt ?? null,
    git: evidence.git ?? {},
    commands: (evidence.commands ?? []).map(normalizeCommand),
    summary: evidence.summary ?? [],
    risks: evidence.risks ?? [],
    nextSteps: evidence.nextSteps ?? [],
    packageContents: evidence.packageContents ?? []
  };
}

export function checkEvidence(evidence, requirements = ["verification", "risks"]) {
  const normalized = normalizeEvidence(evidence);
  const findings = [];
  if (requirements.includes("verification") && normalized.commands.length === 0) {
    findings.push("Missing verification commands");
  }
  if (requirements.includes("verification") && normalized.commands.some((command) => command.exitCode !== 0)) {
    findings.push("One or more verification commands failed");
  }
  if (requirements.includes("risks") && normalized.risks.length === 0) {
    findings.push("Missing residual risk notes");
  }
  if (requirements.includes("summary") && normalized.summary.length === 0) {
    findings.push("Missing reviewer summary");
  }
  if (normalized.git.dirty) findings.push("Git working tree was dirty when evidence was collected");
  return {
    ok: findings.length === 0,
    findings
  };
}

function normalizeCommand(command) {
  return {
    command: command.command,
    exitCode: Number(command.exitCode ?? command.code ?? 0),
    durationMs: command.durationMs ?? null,
    summary: command.summary ?? "",
    stdoutTail: command.stdoutTail ?? "",
    stderrTail: command.stderrTail ?? ""
  };
}
