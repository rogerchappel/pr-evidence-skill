import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const binPath = pkg.bin["pr-evidence"].replace(/^\.\//, "");

const requiredFiles = [
  "package.json",
  binPath,
  "src/evidence.js",
  "src/render.js",
  "fixtures/evidence-pass.json",
  "fixtures/commands-pass.json",
  "docs/RELEASE_CANDIDATE.md",
  "SKILL.md",
  "README.md",
  "LICENSE",
  "SECURITY.md",
  "CONTRIBUTING.md",
  "CHANGELOG.md"
];

const pack = spawnSync("npm", ["pack", "--dry-run", "--json"], {
  encoding: "utf8"
});

if (pack.error) throw pack.error;
if (pack.status !== 0) {
  process.stderr.write(pack.stderr);
  process.exit(pack.status || 1);
}

const [manifest] = JSON.parse(pack.stdout);
const packedFiles = new Set(manifest.files.map((file) => file.path));
const missing = requiredFiles.filter((file) => !packedFiles.has(file));

if (missing.length > 0) {
  console.error(`package smoke failed; missing files: ${missing.join(", ")}`);
  process.exit(1);
}

const binFile = manifest.files.find((file) => file.path === binPath);
if (!binFile) {
  console.error(`package smoke failed; bin target is not packed: ${binPath}`);
  process.exit(1);
}

if ((binFile.mode & 0o111) === 0) {
  console.error(`package smoke failed; bin target is not executable: ${binPath}`);
  process.exit(1);
}

const version = spawnSync(process.execPath, [binPath, "--version"], {
  encoding: "utf8"
});

if (version.status !== 0) {
  process.stderr.write(version.stderr);
  process.exit(version.status || 1);
}

if (version.stdout.trim() !== pkg.version) {
  console.error(`package smoke failed; expected version ${pkg.version}, got ${version.stdout.trim()}`);
  process.exit(1);
}

console.log(`package smoke passed; checked ${requiredFiles.length} files, bin mode, and CLI version`);
