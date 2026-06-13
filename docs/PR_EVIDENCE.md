# PR Evidence: pr-evidence-skill

## Summary

- Built a local-first PR evidence packer for agent-authored release candidates.
- Added git evidence collection, command-result normalization, evidence checks, Markdown rendering, fixtures, tests, and skill instructions.
- Kept V1 free of GitHub writes, artifact uploads, publishing, tagging, or merge automation.

## Verification

- `npm test`: pass, 3 tests.
- `npm run check`: pass.
- `npm run smoke`: pass, rendered fixture Markdown pack.
- `npm run fixture:collect`: pass.
- `bash scripts/validate.sh`: pass, includes `npm pack --dry-run`.

## Package Contents

- `src/cli.js`
- `src/git.js`
- `src/evidence.js`
- `src/render.js`
- `fixtures/`
- `docs/`
- `SKILL.md`
- `README.md`

## Residual Risks

- V1 trusts caller-supplied command summaries.
- Package content parsing is caller-supplied in V1.
- Remote PR state inspection is out of scope.
