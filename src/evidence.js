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
  if (!Array.isArray(commands)) {
    throw new Error('Evidence field "commands" must be an array');
  }
  if (!isPlainObject(notes)) {
    throw new Error('Evidence notes root must be a plain object');
  }
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
  validateEvidence(evidence);
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

export function validateEvidence(evidence) {
  if (!isPlainObject(evidence)) {
    throw new Error("Evidence root must be a plain object");
  }

  for (const field of ["commands", "summary", "risks", "nextSteps", "packageContents"]) {
    if (evidence[field] !== undefined && !Array.isArray(evidence[field])) {
      throw new Error(`Evidence field "${field}" must be an array`);
    }
  }

  for (const [index, command] of (evidence.commands ?? []).entries()) {
    if (!isPlainObject(command)) {
      throw new Error(`Evidence field "commands[${index}]" must be a plain object`);
    }
    if (typeof command.command !== "string" || command.command.trim().length === 0) {
      throw new Error(`Evidence field "commands[${index}].command" must be a non-empty string`);
    }
    const status = Object.hasOwn(command, "exitCode") ? command.exitCode : command.code;
    if (!Number.isFinite(status) || !Number.isInteger(status)) {
      throw new Error(`Evidence field "commands[${index}]" must include an integer exitCode (or legacy code)`);
    }
  }

  for (const field of ["summary", "risks", "nextSteps", "packageContents"]) {
    for (const [index, item] of (evidence[field] ?? []).entries()) {
      if (typeof item !== "string" || item.trim().length === 0) {
        throw new Error(`Evidence field "${field}[${index}]" must be a non-empty string`);
      }
    }
  }
}

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function checkEvidence(evidence, requirements = ["verification", "risks"]) {
  const normalized = normalizeEvidence(evidence);
  const findings = validateRequirements(requirements);
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
