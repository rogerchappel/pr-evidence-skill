import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkEvidence, normalizeEvidence, readJson } from "../src/evidence.js";
import { collectGitEvidence } from "../src/git.js";
import { renderMarkdown } from "../src/render.js";

test("passes complete fixture evidence", async () => {
  const evidence = await readJson("fixtures/evidence-pass.json");
  const result = checkEvidence(evidence, ["verification", "risks", "summary"]);
  assert.equal(result.ok, true);
});

test("flags incomplete fixture evidence", async () => {
  const evidence = await readJson("fixtures/evidence-incomplete.json");
  const result = checkEvidence(evidence, ["verification", "risks", "summary"]);
  assert.equal(result.ok, false);
  assert.match(result.findings.join(" "), /Missing verification/);
  assert.match(result.findings.join(" "), /dirty/);
});

test("requires an explicit finite integer command status", () => {
  const cases = [
    { label: "missing", command: { command: "npm test" }, throws: true },
    { label: "null", command: { command: "npm test", exitCode: null }, throws: true },
    { label: "non-numeric", command: { command: "npm test", exitCode: "0" }, throws: true },
    { label: "zero", command: { command: "npm test", exitCode: 0 }, ok: true },
    { label: "nonzero", command: { command: "npm test", exitCode: 1 }, ok: false },
    { label: "legacy code", command: { command: "npm test", code: 0 }, ok: true }
  ];

  for (const { label, command, ok, throws } of cases) {
    const run = () => checkEvidence({ commands: [command], risks: ["none"] });
    if (throws) assert.throws(run, /integer exitCode/, label);
    else assert.equal(run().ok, ok, label);
  }
});

test("requires a non-empty verification command name", () => {
  for (const command of [
    { exitCode: 0 },
    { command: "", exitCode: 0 },
    { command: "   ", exitCode: 0 },
    { command: 42, exitCode: 0 }
  ]) {
    assert.throws(
      () => checkEvidence({ commands: [command], risks: ["none"] }),
      /commands\[0\]\.command.*non-empty string/i
    );
  }
});

test("rejects malformed optional command metadata with field-specific diagnostics", () => {
  const cases = [
    { field: "durationMs", value: -1, message: /commands\[0\]\.durationMs.*non-negative finite number/ },
    { field: "durationMs", value: Infinity, message: /commands\[0\]\.durationMs.*non-negative finite number/ },
    { field: "durationMs", value: "10", message: /commands\[0\]\.durationMs.*non-negative finite number/ },
    { field: "summary", value: {}, message: /commands\[0\]\.summary.*string/ },
    { field: "stdoutTail", value: ["ok"], message: /commands\[0\]\.stdoutTail.*string/ },
    { field: "stderrTail", value: 1, message: /commands\[0\]\.stderrTail.*string/ }
  ];

  for (const { field, value, message } of cases) {
    const evidence = {
      commands: [{ command: "npm test", exitCode: 0, [field]: value }],
      risks: ["none"]
    };
    assert.throws(() => normalizeEvidence(evidence), message, field);
    assert.throws(() => checkEvidence(evidence), message, field);
    assert.throws(() => renderMarkdown(evidence), message, field);
  }
});

test("normalizes omitted command metadata and renders valid metadata deterministically", () => {
  assert.deepEqual(normalizeEvidence({ commands: [{ command: "npm test", exitCode: 0 }] }).commands[0], {
    command: "npm test",
    exitCode: 0,
    durationMs: null,
    summary: "",
    stdoutTail: "",
    stderrTail: ""
  });

  const evidence = {
    commands: [{
      command: "npm test",
      exitCode: 0,
      durationMs: 12.5,
      summary: "All tests passed.",
      stdoutTail: "ok",
      stderrTail: ""
    }],
    risks: ["none"]
  };
  assert.equal(renderMarkdown(evidence), renderMarkdown(evidence));
  assert.match(renderMarkdown(evidence), /`npm test`: pass \(12\.5ms\) - All tests passed\./);
  assert.deepEqual(normalizeEvidence(normalizeEvidence(evidence)), normalizeEvidence(evidence));
  assert.doesNotThrow(() => renderMarkdown({ commands: [{ command: "npm test", exitCode: 0 }], risks: ["none"] }));
});

test("validates schema version and rendered git fields", () => {
  const cases = [
    { value: { schemaVersion: 2 }, message: /"schemaVersion" must be 1/ },
    { value: { git: [] }, message: /"git" must be a plain object/ },
    { value: { git: { commits: "abc" } }, message: /"git.commits" must be an array/ },
    { value: { git: { commits: [null] } }, message: /"git.commits\[0\]" must be a non-empty string/ },
    { value: { git: { changedFiles: {} } }, message: /"git.changedFiles" must be an array/ },
    { value: { git: { dirty: "false" } }, message: /"git.dirty" must be a boolean/ },
    { value: { git: { head: 42 } }, message: /"git.head" must be a string or null/ }
  ];
  for (const { value, message } of cases) {
    assert.throws(() => normalizeEvidence(value), message);
    assert.throws(() => checkEvidence(value), message);
    assert.throws(() => renderMarkdown(value), message);
  }
});

test("CLI check and render reject unsupported schemas and malformed git evidence", () => {
  const directory = mkdtempSync(join(tmpdir(), "pr-evidence-git-schema-"));
  const cases = [
    { name: "version", value: { schemaVersion: "wrong" }, message: /schemaVersion/ },
    { name: "commits", value: { git: { commits: "abc" } }, message: /git.commits/ },
    { name: "dirty", value: { git: { dirty: "false" } }, message: /git.dirty/ }
  ];
  try {
    for (const { name, value, message } of cases) {
      const evidencePath = join(directory, `${name}.json`);
      writeFileSync(evidencePath, JSON.stringify(value));
      for (const command of ["check", "render"]) {
        const result = runCli(command, evidencePath);
        assert.equal(result.status, 1, `${command}: ${result.stdout || result.stderr}`);
        assert.match(result.stderr, message);
        assert.doesNotMatch(result.stderr, /TypeError/);
      }
    }
  } finally {
    rmSync(directory, { recursive: true });
  }
});

test("rejects unknown and empty evidence requirements", () => {
  const evidence = {
    commands: [{ command: "npm test", exitCode: 0 }],
    risks: ["none"],
    summary: ["ready"]
  };

  assert.deepEqual(checkEvidence(evidence, ["verification", "typo"]).findings, [
    'Unknown evidence requirement "typo"; expected verification, risks, or summary'
  ]);
  assert.deepEqual(checkEvidence(evidence, [""]).findings, [
    "Evidence requirements must not be empty; expected verification, risks, or summary"
  ]);
  assert.equal(checkEvidence(evidence, ["verification", "risks", "summary"]).ok, true);
});

test("CLI rejects malformed and failed command statuses", () => {
  const directory = mkdtempSync(join(tmpdir(), "pr-evidence-status-"));
  const cases = [
    { label: "missing", command: { command: "npm test" }, status: 1 },
    { label: "null", command: { command: "npm test", exitCode: null }, status: 1 },
    { label: "non-numeric", command: { command: "npm test", exitCode: "0" }, status: 1 },
    { label: "zero", command: { command: "npm test", exitCode: 0 }, status: 0 },
    { label: "nonzero", command: { command: "npm test", exitCode: 2 }, status: 1 }
  ];

  try {
    for (const { label, command, status } of cases) {
      const evidencePath = join(directory, `${label}.json`);
      writeFileSync(evidencePath, JSON.stringify({ commands: [command], risks: ["none"] }));
      const result = spawnSync(process.execPath, ["src/cli.js", "check", evidencePath], {
        encoding: "utf8"
      });

      assert.equal(result.status, status, `${label}: ${result.stdout || result.stderr}`);
    }
  } finally {
    rmSync(directory, { recursive: true });
  }
});

test("CLI rejects unnamed verification commands", () => {
  const directory = mkdtempSync(join(tmpdir(), "pr-evidence-command-"));
  const evidencePath = join(directory, "unnamed.json");

  try {
    writeFileSync(evidencePath, JSON.stringify({ commands: [{ exitCode: 0 }], risks: ["none"] }));
    const result = runCli("check", evidencePath);

    assert.equal(result.status, 1);
    assert.match(result.stderr, /commands\[0\]\.command.*non-empty string/i);
  } finally {
    rmSync(directory, { recursive: true });
  }
});

test("CLI rejects unknown, empty, and mixed invalid requirements", () => {
  for (const value of ["typo", "", "verification,typo", "verification,"]) {
    const result = runCli(
      "check",
      "fixtures/evidence-pass.json",
      "--require",
      value
    );

    assert.equal(result.status, 1, `${JSON.stringify(value)}: ${result.stdout || result.stderr}`);
    assert.match(result.stdout, /expected verification, risks, or summary/);
  }
});

test("CLI accepts every supported evidence requirement", () => {
  const result = runCli(
    "check",
    "fixtures/evidence-pass.json",
    "--require",
    "verification,risks,summary"
  );

  assert.equal(result.status, 0, result.stdout || result.stderr);
  assert.match(result.stdout, /"ok": true/);
});

test("renders reviewer-facing markdown", async () => {
  const evidence = await readJson("fixtures/evidence-pass.json");
  const markdown = renderMarkdown(evidence);
  assert.match(markdown, /PR Evidence Pack/);
  assert.match(markdown, /npm test/);
  assert.match(markdown, /Evidence Check/);
});

test("CLI prints package version", () => {
  const pkg = JSON.parse(readFileSync("package.json", "utf8"));
  const result = spawnSync(process.execPath, ["src/cli.js", "--version"], {
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), pkg.version);
});

test("CLI renders each documented format", () => {
  const markdown = runCli("render", "fixtures/evidence-pass.json", "--format", "markdown");
  assert.equal(markdown.status, 0, markdown.stderr);
  assert.match(markdown.stdout, /^# PR Evidence Pack/m);

  const json = runCli("render", "fixtures/evidence-pass.json", "--format", "json");
  assert.equal(json.status, 0, json.stderr);
  assert.doesNotThrow(() => JSON.parse(json.stdout));
});

test("API rejects malformed evidence containers with field-specific diagnostics", () => {
  const cases = [
    { value: null, message: /root must be a plain object/ },
    { value: [], message: /root must be a plain object/ },
    { value: { commands: {} }, message: /"commands" must be an array/ },
    { value: { summary: "ready" }, message: /"summary" must be an array/ },
    { value: { commands: [null] }, message: /"commands\[0\]" must be a plain object/ },
    { value: { risks: [null] }, message: /"risks\[0\]" must be a non-empty string/ },
    { value: { packageContents: ["ok", {}] }, message: /"packageContents\[1\]"/ }
  ];

  for (const { value, message } of cases) {
    assert.throws(() => normalizeEvidence(value), message);
    assert.throws(() => checkEvidence(value), message);
    assert.throws(() => renderMarkdown(value), message);
  }
});

test("CLI check and render reject the same malformed evidence", () => {
  const directory = mkdtempSync(join(tmpdir(), "pr-evidence-schema-"));
  const evidencePath = join(directory, "malformed.json");
  try {
    writeFileSync(evidencePath, JSON.stringify({ summary: "ready" }));
    for (const command of ["check", "render"]) {
      const result = runCli(command, evidencePath);
      assert.equal(result.status, 1, `${command}: ${result.stdout || result.stderr}`);
      assert.equal(result.stdout, "");
      assert.match(result.stderr, /Evidence field "summary" must be an array/);
      assert.doesNotMatch(result.stderr, /TypeError/);
    }
  } finally {
    rmSync(directory, { recursive: true });
  }
});

test("CLI check and render reject malformed optional command metadata", () => {
  const directory = mkdtempSync(join(tmpdir(), "pr-evidence-command-metadata-"));
  const cases = [
    { field: "durationMs", value: -1, message: /commands\[0\]\.durationMs/ },
    { field: "durationMs", value: "10", message: /commands\[0\]\.durationMs/ },
    { field: "summary", value: {}, message: /commands\[0\]\.summary/ },
    { field: "stdoutTail", value: 1, message: /commands\[0\]\.stdoutTail/ },
    { field: "stderrTail", value: [], message: /commands\[0\]\.stderrTail/ }
  ];

  try {
    for (const { field, value, message } of cases) {
      const evidencePath = join(directory, `${field}-${typeof value}.json`);
      writeFileSync(evidencePath, JSON.stringify({
        commands: [{ command: "npm test", exitCode: 0, [field]: value }],
        risks: ["none"]
      }));
      for (const command of ["check", "render"]) {
        const result = runCli(command, evidencePath);
        assert.equal(result.status, 1, `${command} ${field}: ${result.stdout || result.stderr}`);
        assert.equal(result.stdout, "");
        assert.match(result.stderr, message);
      }
    }
  } finally {
    rmSync(directory, { recursive: true });
  }
});

test("CLI collect rejects malformed command and notes containers", () => {
  const directory = mkdtempSync(join(tmpdir(), "pr-evidence-collect-schema-"));
  const commandsPath = join(directory, "commands.json");
  const notesPath = join(directory, "notes.json");
  try {
    writeFileSync(commandsPath, JSON.stringify({ command: "npm test", exitCode: 0 }));
    writeFileSync(notesPath, "null");

    const commands = runCli("collect", "--commands", commandsPath);
    assert.equal(commands.status, 1);
    assert.match(commands.stderr, /Evidence field "commands" must be an array/);

    writeFileSync(commandsPath, "[]");
    const notes = runCli("collect", "--commands", commandsPath, "--notes", notesPath);
    assert.equal(notes.status, 1);
    assert.match(notes.stderr, /Evidence notes root must be a plain object/);
    assert.doesNotMatch(notes.stderr, /TypeError/);
  } finally {
    rmSync(directory, { recursive: true });
  }
});

test("git collection rejects an invalid base with an actionable diagnostic", async () => {
  const repository = createGitRepository();
  try {
    await assert.rejects(
      collectGitEvidence(repository, "definitely-not-a-ref"),
      /Cannot resolve base revision "definitely-not-a-ref" to a commit/
    );
  } finally {
    rmSync(repository, { recursive: true });
  }
});

test("default git collection compares a root commit with the empty tree", async () => {
  const repository = createGitRepository();
  try {
    const evidence = await collectGitEvidence(repository);

    assert.equal(evidence.base, "empty tree (root commit)");
    assert.match(evidence.commits[0], /initial commit/);
    assert.deepEqual(evidence.changedFiles, ["first.txt"]);
  } finally {
    rmSync(repository, { recursive: true });
  }
});

test("CLI collect succeeds by default in a one-commit repository", () => {
  const repository = createGitRepository();
  const outputPath = join(repository, "evidence.json");
  try {
    const result = runCli(
      "collect",
      "--commands", join(process.cwd(), "fixtures/commands-pass.json"),
      "--cwd", repository,
      "--out", outputPath
    );

    assert.equal(result.status, 0, result.stderr);
    const evidence = JSON.parse(readFileSync(outputPath, "utf8"));
    assert.equal(evidence.git.base, "empty tree (root commit)");
    assert.match(evidence.git.commits[0], /initial commit/);
    assert.deepEqual(evidence.git.changedFiles, ["first.txt"]);
  } finally {
    rmSync(repository, { recursive: true });
  }
});

test("CLI collect rejects a shallow tip whose parent history is unavailable", () => {
  const source = createGitRepository();
  const cloneParent = mkdtempSync(join(tmpdir(), "pr-evidence-shallow-"));
  const shallow = join(cloneParent, "clone");
  const outputPath = join(shallow, "evidence.json");
  try {
    writeFileSync(join(source, "second.txt"), "second\n");
    runGit(source, "add", "second.txt");
    runGit(source, "commit", "--quiet", "-m", "add second file");
    runGit(cloneParent, "clone", "--quiet", "--depth", "1", `file://${source}`, shallow);

    const result = runCli(
      "collect",
      "--commands", join(process.cwd(), "fixtures/commands-pass.json"),
      "--cwd", shallow,
      "--out", outputPath
    );

    assert.equal(result.status, 1);
    assert.equal(result.stdout, "");
    assert.match(result.stderr, /Cannot determine the default base from shallow history/);
    assert.match(result.stderr, /fetch the parent history|--base/);
    assert.throws(() => readFileSync(outputPath), /ENOENT/);
  } finally {
    rmSync(source, { recursive: true });
    rmSync(cloneParent, { recursive: true });
  }
});

test("git collection preserves valid empty and non-empty comparisons", async () => {
  const repository = createGitRepository();
  try {
    const empty = await collectGitEvidence(repository, "HEAD");
    assert.deepEqual(empty.commits, []);
    assert.deepEqual(empty.changedFiles, []);

    writeFileSync(join(repository, "second.txt"), "second\n");
    runGit(repository, "add", "second.txt");
    runGit(repository, "commit", "-m", "add second file");

    const nonEmpty = await collectGitEvidence(repository, "HEAD~1");
    assert.match(nonEmpty.commits[0], /add second file/);
    assert.deepEqual(nonEmpty.changedFiles, ["second.txt"]);
  } finally {
    rmSync(repository, { recursive: true });
  }
});

test("CLI collect fails nonzero for an invalid base without writing evidence", () => {
  const repository = createGitRepository();
  const outputPath = join(repository, "evidence.json");
  try {
    const result = runCli(
      "collect",
      "--commands", join(process.cwd(), "fixtures/commands-pass.json"),
      "--cwd", repository,
      "--base", "definitely-not-a-ref",
      "--out", outputPath
    );

    assert.equal(result.status, 1);
    assert.equal(result.stdout, "");
    assert.match(result.stderr, /Cannot resolve base revision "definitely-not-a-ref" to a commit/);
    assert.throws(() => readFileSync(outputPath), /ENOENT/);
  } finally {
    rmSync(repository, { recursive: true });
  }
});

test("CLI rejects unsupported formats", () => {
  const result = runCli("render", "fixtures/evidence-pass.json", "--format", "yaml");

  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /Invalid --format "yaml"; expected markdown or json/);
});

test("CLI rejects unknown options", () => {
  const result = runCli("render", "fixtures/evidence-pass.json", "--bogus", "value");

  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /Unknown option for render: --bogus/);
});

test("CLI rejects missing option values", () => {
  for (const values of [
    ["render", "fixtures/evidence-pass.json", "--format"],
    ["render", "fixtures/evidence-pass.json", "--format", "--out", "result.md"]
  ]) {
    const result = runCli(...values);
    assert.equal(result.status, 1);
    assert.equal(result.stdout, "");
    assert.match(result.stderr, /Missing value for --format/);
  }
});

function runCli(...args) {
  return spawnSync(process.execPath, ["src/cli.js", ...args], {
    encoding: "utf8"
  });
}

function createGitRepository() {
  const repository = mkdtempSync(join(tmpdir(), "pr-evidence-git-"));
  runGit(repository, "init", "--quiet");
  runGit(repository, "config", "user.name", "Test Author");
  runGit(repository, "config", "user.email", "test@example.com");
  writeFileSync(join(repository, "first.txt"), "first\n");
  runGit(repository, "add", "first.txt");
  runGit(repository, "commit", "--quiet", "-m", "initial commit");
  return repository;
}

function runGit(cwd, ...args) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
}
