#!/usr/bin/env bash
set -euo pipefail

if [ ! -f "packages/cli/dist/index.js" ] || [ ! -f "packages/core/dist/index.js" ]; then
  npm run build >/dev/null
fi

node packages/cli/dist/index.js "$@"
