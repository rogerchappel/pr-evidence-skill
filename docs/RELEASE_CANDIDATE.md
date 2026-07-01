# Release Candidate Notes

## Scope

Initial public build with local git evidence collection, command-result normalization, Markdown rendering, checks, fixtures, and agent-facing skill guidance.

## Verification

- `npm test`
- `npm run check`
- `npm run smoke`
- `npm run fixture:collect`
- `npm run package:smoke`
- `npm run release:check`

## Residual Risks

- V1 trusts caller-supplied command summaries.
- Full command-log capture is future work.
- The tool does not inspect remote PR state.
