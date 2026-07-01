#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { writeFile } from "node:fs/promises";
import { checkEvidence, collectEvidence, readJson } from "./evidence.js";
import { renderJson, renderMarkdown } from "./render.js";

async function main(argv) {
  const [command, ...rest] = argv;
  const args = parseArgs(rest);
  if (!command || command === "--help" || command === "-h" || args.help) return usage();
  if (command === "--version" || command === "-v") return version();

  if (command === "collect") {
    const evidence = await collectEvidence({
      commands: args.commands,
      notes: args.notes,
      base: args.base,
      cwd: args.cwd
    });
    return output(args, renderJson(evidence));
  }

  if (command === "render") {
    const evidence = await readJson(required(args, "_0"));
    const rendered = args.format === "json" ? renderJson(evidence) : renderMarkdown(evidence);
    return output(args, rendered);
  }

  if (command === "check") {
    const evidence = await readJson(required(args, "_0"));
    const requirements = args.require ? args.require.split(",").map((item) => item.trim()) : undefined;
    const result = checkEvidence(evidence, requirements);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if (!result.ok) process.exitCode = 1;
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

function parseArgs(values) {
  const args = { _: [] };
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value.startsWith("--")) {
      const key = value.slice(2);
      if (key === "help") args.help = true;
      else {
        args[key] = values[index + 1];
        index += 1;
      }
    } else {
      args._.push(value);
      args[`_${args._.length - 1}`] = value;
    }
  }
  return args;
}

function required(args, key) {
  if (!args[key]) throw new Error(`Missing ${key === "_0" ? "input file" : `--${key}`}`);
  return args[key];
}

async function output(args, text) {
  if (args.out) await writeFile(args.out, text, "utf8");
  else process.stdout.write(text);
}

function usage() {
  process.stdout.write(`pr-evidence

Commands:
  collect --commands commands.json [--notes notes.json] [--base main] [--out evidence.json]
  render evidence.json [--format markdown|json] [--out pr-body.md]
  check evidence.json [--require verification,risks,summary]
`);
}

async function version() {
  const packageJson = JSON.parse(
    await readFile(new URL("../package.json", import.meta.url), "utf8")
  );
  process.stdout.write(`${packageJson.version}\n`);
}

main(process.argv.slice(2)).catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
