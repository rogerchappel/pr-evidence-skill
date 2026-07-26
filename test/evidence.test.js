import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkEvidence, readJson } from "../src/evidence.js";
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
    { label: "missing", command: { command: "npm test" }, ok: false },
    { label: "null", command: { command: "npm test", exitCode: null }, ok: false },
    { label: "non-numeric", command: { command: "npm test", exitCode: "0" }, ok: false },
    { label: "zero", command: { command: "npm test", exitCode: 0 }, ok: true },
    { label: "nonzero", command: { command: "npm test", exitCode: 1 }, ok: false },
    { label: "legacy code", command: { command: "npm test", code: 0 }, ok: true }
  ];

  for (const { label, command, ok } of cases) {
    const result = checkEvidence({ commands: [command], risks: ["none"] });
    assert.equal(result.ok, ok, label);
  }
});

test("requires a non-empty verification command name", () => {
  for (const command of [
    { exitCode: 0 },
    { command: "", exitCode: 0 },
    { command: "   ", exitCode: 0 },
    { command: 42, exitCode: 0 }
  ]) {
    const result = checkEvidence({ commands: [command], risks: ["none"] });
    assert.equal(result.ok, false);
    assert.match(result.findings.join(" "), /missing a non-empty command name/i);
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
    assert.match(result.stdout, /missing a non-empty command name/i);
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
