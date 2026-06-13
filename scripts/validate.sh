#!/usr/bin/env bash
set -euo pipefail

npm test
npm run check
npm run smoke
npm run fixture:collect
npm pack --dry-run
