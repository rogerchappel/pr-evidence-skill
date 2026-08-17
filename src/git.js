import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export async function collectGitEvidence(cwd = process.cwd(), base) {
  const branch = await git(["rev-parse", "--abbrev-ref", "HEAD"], cwd);
  const head = await git(["rev-parse", "HEAD"], cwd);
  const status = await git(["status", "--short"], cwd);
  const defaultBase = base === undefined;
  const requestedBase = base ?? "HEAD~1";
  const rootComparison = defaultBase && !(await resolvesToCommit(requestedBase, cwd));

  if (rootComparison) {
    const shallow = (await git(
      ["rev-parse", "--is-shallow-repository"],
      cwd,
      "Cannot determine whether repository history is shallow"
    )).trim() === "true";

    if (shallow) {
      throw new Error(
        "Cannot determine the default base from shallow history; fetch the parent history or pass --base with an available commit"
      );
    }

    const commits = await git(["log", "--oneline", "HEAD"], cwd);
    const changedFiles = await git(
      ["diff-tree", "--root", "--no-commit-id", "--name-only", "-r", "HEAD"],
      cwd
    );

    return {
      branch: branch.trim(),
      head: head.trim(),
      base: "empty tree (root commit)",
      dirty: status.trim().length > 0,
      status: lines(status),
      commits: lines(commits),
      changedFiles: lines(changedFiles)
    };
  }

  const resolvedBase = await git(
    ["rev-parse", "--verify", "--end-of-options", `${requestedBase}^{commit}`],
    cwd,
    `Cannot resolve base revision "${requestedBase}" to a commit`
  );
  const range = `${resolvedBase.trim()}..${head.trim()}`;
  const commits = await git(["log", "--oneline", range], cwd, `Cannot compare commits from base "${requestedBase}"`);
  const changedFiles = await git(
    ["diff", "--name-only", range],
    cwd,
    `Cannot compare changed files from base "${requestedBase}"`
  );

  return {
    branch: branch.trim(),
    head: head.trim(),
    base: requestedBase,
    dirty: status.trim().length > 0,
    status: lines(status),
    commits: lines(commits),
    changedFiles: lines(changedFiles)
  };
}

async function resolvesToCommit(revision, cwd) {
  try {
    await execFileAsync("git", ["rev-parse", "--verify", "--end-of-options", `${revision}^{commit}`], { cwd });
    return true;
  } catch {
    return false;
  }
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
