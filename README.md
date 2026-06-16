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

## Command Result Format

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
