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
