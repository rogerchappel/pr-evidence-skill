# Contributing

Thanks for helping improve `pr-evidence-skill`.

## Development

Use a supported Node.js release (20, 22, or 24). CI verifies every supported
release against the committed lockfile.

```sh
npm ci
npm run release:check
```

Keep fixtures deterministic, avoid embedding private logs, and include the exact
verification command in pull requests.

## Pull Requests

- Keep changes focused on one evidence or rendering behavior.
- Update README, docs, or fixtures when CLI behavior changes.
- Do not add network calls, GitHub API writes, publishing, or release tagging
  without documenting the new safety model first.
