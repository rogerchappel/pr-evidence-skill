import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export async function collectGitEvidence(cwd = process.cwd(), base = "HEAD~1") {
  const branch = await git(["rev-parse", "--abbrev-ref", "HEAD"], cwd);
  const head = await git(["rev-parse", "HEAD"], cwd);
  const status = await git(["status", "--short"], cwd);
  const resolvedBase = await git(
    ["rev-parse", "--verify", "--end-of-options", `${base}^{commit}`],
    cwd,
    `Cannot resolve base revision "${base}" to a commit`
  );
  const range = `${resolvedBase.trim()}..${head.trim()}`;
  const commits = await git(["log", "--oneline", range], cwd, `Cannot compare commits from base "${base}"`);
  const changedFiles = await git(
    ["diff", "--name-only", range],
    cwd,
    `Cannot compare changed files from base "${base}"`
  );

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

async function git(args, cwd, context = `Git command failed: git ${args.join(" ")}`) {
  try {
    const { stdout } = await execFileAsync("git", args, { cwd });
    return stdout;
  } catch (error) {
    const detail = error.stderr?.trim() || error.message;
    throw new Error(`${context}: ${detail}`);
  }
}

function lines(value) {
  return value.split("\n").map((line) => line.trim()).filter(Boolean);
}
