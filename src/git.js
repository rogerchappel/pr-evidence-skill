import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export async function collectGitEvidence(cwd = process.cwd(), base = "HEAD~1") {
  const branch = await git(["rev-parse", "--abbrev-ref", "HEAD"], cwd);
  const head = await git(["rev-parse", "HEAD"], cwd);
  const status = await git(["status", "--short"], cwd);
  const commits = await optionalGit(["log", "--oneline", `${base}..HEAD`], cwd);
  const changedFiles = await optionalGit(["diff", "--name-only", `${base}..HEAD`], cwd);

  return {
    branch: branch.trim(),
    head: head.trim(),
    base,
    dirty: status.trim().length > 0,
    status: lines(status),
    commits: lines(commits),
    changedFiles: lines(changedFiles)
  };
}

async function git(args, cwd) {
  const { stdout } = await execFileAsync("git", args, { cwd });
  return stdout;
}

async function optionalGit(args, cwd) {
  try {
    return await git(args, cwd);
  } catch {
    return "";
  }
}

function lines(value) {
  return value.split("\n").map((line) => line.trim()).filter(Boolean);
}
