# Examples

## Render Fixture Evidence

```bash
pr-evidence render fixtures/evidence-pass.json --format markdown
```

## Check Required Sections

```bash
pr-evidence check fixtures/evidence-pass.json --require verification,risks,summary
```

## Collect Local Evidence

```bash
pr-evidence collect \
  --commands fixtures/commands-pass.json \
  --notes fixtures/notes.json \
  --out evidence.json
```

Keep the rendered output concise enough for a PR body and link to full logs only when project policy allows it.
