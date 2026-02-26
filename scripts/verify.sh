#!/usr/bin/env bash
set -euo pipefail

echo "[verify] lint"
npm run lint

echo "[verify] h0 gate"
npm run h0:check

echo "[verify] direct-writes gate"
node scripts/check_direct_writes.mjs

echo "[verify] compat checklist gate"
node scripts/compat_lint.mjs

echo "[verify] architecture governance gate"
npm run governance:check

echo "[verify] changelog gate"
npm run changelog:check

echo "[verify] typecheck"
npm run typecheck

echo "[verify] build"
npm run build

echo "[verify] test"
test_log="$(mktemp -t soulseed-verify-test.XXXXXX.log)"
set +e
npm run test 2>&1 | tee "$test_log"
test_status=${PIPESTATUS[0]}
set -e

if [[ "$test_status" -ne 0 ]]; then
  echo
  echo "[verify] test failed. Extracting first failing context..."
  first_not_ok_line="$(grep -nE '^not ok [0-9]+' "$test_log" | head -n1 | cut -d: -f1 || true)"
  if [[ -n "$first_not_ok_line" ]]; then
    start_line=$(( first_not_ok_line > 8 ? first_not_ok_line - 8 : 1 ))
    end_line=$(( first_not_ok_line + 80 ))
    echo "[verify] ---- first not ok context (lines ${start_line}-${end_line}) ----"
    awk -v start="$start_line" -v end="$end_line" 'NR >= start && NR <= end { print }' "$test_log"
  else
    echo "[verify] no 'not ok' marker found; showing tail:"
    tail -n 120 "$test_log"
  fi

  echo "[verify] ---- error summary tail ----"
  tail -n 80 "$test_log"
  exit "$test_status"
fi

echo "[verify] ok"
