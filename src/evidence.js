import { readFile } from "node:fs/promises";
import { collectGitEvidence } from "./git.js";

export const EVIDENCE_REQUIREMENTS = ["verification", "risks", "summary"];

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
  const findings = validateRequirements(requirements);
  if (requirements.includes("verification") && normalized.commands.length === 0) {
    findings.push("Missing verification commands");
  }
  if (
    requirements.includes("verification")
    && normalized.commands.some(
      (command) => typeof command.command !== "string" || command.command.trim().length === 0
    )
  ) {
    findings.push("One or more verification commands is missing a non-empty command name");
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

function validateRequirements(requirements) {
  const expected = EVIDENCE_REQUIREMENTS.join(", ").replace(/, ([^,]+)$/, ", or $1");
  return requirements.flatMap((requirement) => {
    if (requirement === "") {
      return [`Evidence requirements must not be empty; expected ${expected}`];
    }
    if (!EVIDENCE_REQUIREMENTS.includes(requirement)) {
      return [`Unknown evidence requirement "${requirement}"; expected ${expected}`];
    }
    return [];
  });
}

function normalizeCommand(command) {
  const status = Object.hasOwn(command, "exitCode")
    ? command.exitCode
    : command.code;

  return {
    command: command.command,
    exitCode: Number.isFinite(status) && Number.isInteger(status) ? status : null,
    durationMs: command.durationMs ?? null,
    summary: command.summary ?? "",
    stdoutTail: command.stdoutTail ?? "",
    stderrTail: command.stderrTail ?? ""
  };
}
