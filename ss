#!/usr/bin/env bash
set -euo pipefail

if [ ! -f "packages/cli/dist/index.js" ] || [ ! -f "packages/core/dist/index.js" ]; then
  npm run build >/dev/null
elif find packages/core/src packages/cli/src -type f -name '*.ts' -newer packages/cli/dist/index.js | grep -q .; then
  npm run build >/dev/null
fi

node packages/cli/dist/index.js "$@"
