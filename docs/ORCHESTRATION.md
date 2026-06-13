# Orchestration

Use this tool after implementation and verification, before opening or updating a release-candidate PR.

1. Run project checks and save concise command summaries to JSON.
2. Add reviewer notes covering summary, residual risks, next steps, and package contents.
3. Run `pr-evidence collect` from the repository root.
4. Run `pr-evidence check` with the repository's required sections.
5. Render Markdown and paste it into the PR body.

The CLI does not call GitHub. It prepares evidence for a separate PR command or manual review step.
