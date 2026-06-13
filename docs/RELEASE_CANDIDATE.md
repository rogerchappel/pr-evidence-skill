# Release Candidate Notes

## Scope

Initial public build with local git evidence collection, command-result normalization, Markdown rendering, checks, fixtures, and agent-facing skill guidance.

## Verification

- `npm test`
- `npm run check`
- `npm run smoke`
- `npm run fixture:collect`

## Residual Risks

- V1 trusts caller-supplied command summaries.
- Full package-content parsing is future work.
- The tool does not inspect remote PR state.
