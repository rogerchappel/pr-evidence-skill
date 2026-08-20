# pr-evidence-skill

Local-first PR evidence packs for agent-authored release-candidate pull requests.

`pr-evidence-skill` collects local git metadata, normalizes verification command results, checks required evidence, and renders a deterministic Markdown PR body. It does not call GitHub or upload logs.

## Quickstart

```bash
npm ci
npm test
npm run smoke
```

Render fixture evidence:

```bash
node src/cli.js render fixtures/evidence-pass.json --format markdown
```

Check the installed command surface:

```bash
node src/cli.js --help
node src/cli.js --version
```

Check required evidence:

```bash
node src/cli.js check fixtures/evidence-pass.json --require verification,risks,summary
```

Collect from the current git repository:

```bash
node src/cli.js collect \
  --commands fixtures/commands-pass.json \
  --notes fixtures/notes.json \
  --out evidence.json
```

The default base is `HEAD~1`. A genuine root commit is compared with the empty
tree. In a shallow clone where the parent is unavailable, collection stops with
an actionable error instead of reporting the tip as a root commit. Fetch enough
history first, or pass `--base <available-commit>` explicitly.

The CLI accepts the `collect`, `render`, and `check` commands shown by
`--help`. Options require a value, `render --format` accepts only `markdown`
or `json`, and unsupported commands or options exit nonzero with an error.
Use `collect --cwd path` to collect repository metadata from another working
directory. The comparison base defaults to `HEAD~1`. In a one-commit repository,
where `HEAD` has no parent, the default instead compares the root commit with the
empty tree so its commit and files are included. An explicit `--base` must resolve
to a commit in that repository. An unresolved base or a failed commit/file
comparison exits nonzero with a Git diagnostic and does not write the requested
output file. A successful comparison may legitimately contain zero commits and
zero changed files, such as when `--base HEAD` is used.

`check --require` accepts only `verification`, `risks`, and `summary` as a
comma-separated list. Unknown or empty names are rejected instead of silently
disabling checks.

## Command Result Format

Evidence JSON has a plain-object root. The five reviewer-facing collections are
arrays; omitted collections default to empty arrays. Each reviewer-facing list
entry must be a non-empty string, and every command entry must be a plain object:

```json
{
  "schemaVersion": 1,
  "collectedAt": "2026-06-13T22:31:00.000Z",
  "git": {},
  "commands": [],
  "summary": ["What changed."],
  "risks": ["Known residual risk."],
  "nextSteps": ["Reviewer action."],
  "packageContents": ["src/evidence.js"]
}
```

`collect`, `check`, and `render` use the same schema validation. Malformed input
exits nonzero with a field-specific diagnostic such as
`Evidence field "summary" must be an array`; it is never accepted by `check`
only to fail later during rendering.

```json
[
  {
    "command": "npm test",
    "exitCode": 0,
    "durationMs": 742,
    "summary": "All fixture-backed tests passed.",
    "stdoutTail": "24 tests passed",
    "stderrTail": ""
  }
]
```

Every command result must include a non-empty string `command` and an explicit
`exitCode` as a finite integer. Use `0` for a successful command and a nonzero
integer for a failed command. The legacy `code` field is also accepted, but
missing, `null`, string, fractional, `NaN`, and infinite status values are
rejected rather than treated as success. `schemaVersion` defaults to and
currently accepts only `1`. Optional `durationMs` must be a
non-negative finite number. Optional `summary`, `stdoutTail`, and `stderrTail`
must be strings. When omitted, duration normalizes to `null` and the string
fields normalize to empty strings. Normalized evidence can be normalized,
checked, or rendered again without changing it. When present, `git` must be an
object: `branch`, `head`, and `base` are strings or null, `dirty` is boolean,
and `commits` and `changedFiles` are arrays of non-empty strings. Invalid fields
produce their full evidence path in the error.

## Safety Notes

- Default commands are local only.
- The tool does not open PRs, publish packages, or tag releases.
- Keep command tails and notes free of secrets or private data.
- Evidence packs help reviewers, but CI and human review still matter.

## Limitations

- Package contents are caller-supplied in V1.
- Full command logs are intentionally not embedded by default.
- Remote PR state is out of scope.

## Verification

```bash
npm run check
npm test
npm run smoke
npm run package:smoke
npm run release:check
```

Use Node.js 20, 22, or 24 and run `npm ci` followed by
`npm run release:check` before publishing or opening a release PR. CI applies
the same deterministic install and release gate to every supported Node.js
release.
`npm run package:smoke` verifies the dry-run tarball includes the CLI, source
modules, fixtures, docs, policies, and executable bin metadata.
