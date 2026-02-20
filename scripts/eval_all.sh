#!/usr/bin/env bash
set -euo pipefail

if [ ! -f "packages/core/dist/index.js" ]; then
  npm run -s build
fi

node ./scripts/quality_scorecard.mjs
