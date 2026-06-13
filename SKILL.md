# pr-evidence-skill

Use this skill when an agent has finished implementation work and needs a compact, reproducible evidence pack before opening or updating a pull request.

## Required Inputs

- Local git repository.
- JSON list of verification commands with exit codes and summaries.
- Optional notes JSON for summary, risks, next steps, and package contents.

## Boundaries

- Do not open, update, merge, or tag PRs from this skill.
- Do not upload logs or artifacts.
- Keep command summaries concise and avoid private data.
- Treat the evidence pack as reviewer context, not a correctness proof.

## Workflow

1. Run the project's verification commands.
2. Record command, exit code, duration, and a short summary in JSON.
3. Run `pr-evidence collect --commands commands.json --notes notes.json --out evidence.json`.
4. Run `pr-evidence check evidence.json --require verification,risks,summary`.
5. Run `pr-evidence render evidence.json --format markdown --out pr-body.md`.
6. Use the rendered body with a separate PR creation or update step.

## Validation

- Run `npm test` after code changes.
- Run `npm run smoke` to render a fixture pack.
- Confirm incomplete evidence fails `pr-evidence check`.
