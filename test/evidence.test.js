import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
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
