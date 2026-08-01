# pr-evidence-skill

Local-first PR evidence packs for agent-authored release-candidate pull requests.

`pr-evidence-skill` collects local git metadata, normalizes verification command results, checks required evidence, and renders a deterministic Markdown PR body. It does not call GitHub or upload logs.

## Quickstart

```bash
npm install
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

The CLI accepts the `collect`, `render`, and `check` commands shown by
`--help`. Options require a value, `render --format` accepts only `markdown`
or `json`, and unsupported commands or options exit nonzero with an error.
Use `collect --cwd path` to collect repository metadata from another working
directory.

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
    "summary": "All fixture-backed tests passed."
  }
]
```

Every command result must include a non-empty string `command` and an explicit
`exitCode` as a finite integer. Use `0` for a successful command and a nonzero
integer for a failed command. The legacy `code` field is also accepted, but
missing, `null`, string, fractional, `NaN`, and infinite status values are
rejected rather than treated as success.

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

Use `npm run release:check` before publishing or opening a release PR.
`npm run package:smoke` verifies the dry-run tarball includes the CLI, source
modules, fixtures, docs, policies, and executable bin metadata.
