#!/usr/bin/env bash
set -euo pipefail

if [ ! -f "packages/core/dist/index.js" ]; then
  npm run -s build
fi

node ./scripts/quality_scorecard.mjs
node ./scripts/eval_phase_j.mjs --strict
node ./scripts/eval_multi_persona.mjs --strict
