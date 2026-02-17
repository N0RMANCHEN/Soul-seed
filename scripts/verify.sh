#!/usr/bin/env bash
set -euo pipefail

echo "[verify] lint"
npm run lint

echo "[verify] typecheck"
npm run typecheck

echo "[verify] build"
npm run build

echo "[verify] test"
npm run test

echo "[verify] ok"
