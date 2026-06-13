# Product Requirements: pr-evidence-skill

`pr-evidence-skill` assembles reviewer-facing evidence packs for agent-authored pull requests.

## Goals

- Collect local git state and caller-supplied verification command results.
- Render deterministic Markdown PR bodies.
- Check whether required verification, risk, and summary sections are present.
- Keep default commands local with no GitHub writes or log uploads.

## Non-Goals

- Opening pull requests.
- Uploading artifacts.
- Replacing CI or proving correctness.

## Acceptance Criteria

- `pr-evidence render` produces a complete Markdown pack from fixtures.
- `pr-evidence check` exits non-zero for incomplete or failed evidence.
- Fixture-backed tests cover passing and incomplete runs.
- `SKILL.md` explains when agents should collect evidence before PR creation.
