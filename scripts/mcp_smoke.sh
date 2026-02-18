#!/usr/bin/env bash
# scripts/mcp_smoke.sh
# MCP server smoke test: verifies JSON-RPC handshake (initialize + tools/list).
# Uses newline-delimited JSON (MCP StdioServerTransport format).
# Usage: ./scripts/mcp_smoke.sh
# Outputs: reports/acceptance/mcp-smoke-<timestamp>.json

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MCP_SERVER="${REPO_ROOT}/packages/mcp-server/dist/index.js"
REPORTS_DIR="${REPO_ROOT}/reports/acceptance"
CORE_DIST="${REPO_ROOT}/packages/core/dist/index.js"

if [ ! -f "${MCP_SERVER}" ]; then
  echo "[mcp_smoke] MCP server not built. Run: npm run build -w @soulseed/mcp-server"
  exit 1
fi

# Create temporary persona
TMPDIR_BASE=$(mktemp -d)
PERSONA_PATH="${TMPDIR_BASE}/SmokePersona.soulseedpersona"
export PERSONA_PATH

node --input-type=module - <<INITEOF
const { initPersonaPackage } = await import('${CORE_DIST}');
await initPersonaPackage(process.env.PERSONA_PATH, 'SmokePersona');
INITEOF

echo "[mcp_smoke] Persona created at: ${PERSONA_PATH}"

# Prepare report dir
mkdir -p "${REPORTS_DIR}"
TS=$(date -u +"%Y-%m-%dT%H-%M-%S-%3NZ" 2>/dev/null || date -u +"%Y-%m-%dT%H-%M-%SZ")
REPORT_FILE="${REPORTS_DIR}/mcp-smoke-${TS}.json"
RESPONSE_FILE=$(mktemp)
export RESPONSE_FILE

# Newline-delimited JSON messages (MCP StdioServerTransport format)
INIT_MSG='{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","clientInfo":{"name":"smoke","version":"0.0.1"},"capabilities":{}}}'
NOTIF_MSG='{"jsonrpc":"2.0","method":"notifications/initialized"}'
LIST_MSG='{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}'

# Spawn server and send messages
{
  printf "%s\n" "${INIT_MSG}"
  sleep 0.5
  printf "%s\n" "${NOTIF_MSG}"
  printf "%s\n" "${LIST_MSG}"
  sleep 3
} | SOULSEED_PERSONA_PATH="${PERSONA_PATH}" \
    node "${MCP_SERVER}" 2>/dev/null > "${RESPONSE_FILE}" || true

echo "[mcp_smoke] Output lines: $(wc -l < "${RESPONSE_FILE}")"

# Parse newline-delimited JSON and validate
VALIDATION_JSON=$(node --input-type=module - <<'VALIDATEEOF'
import { readFileSync } from 'fs';
const raw = readFileSync(process.env.RESPONSE_FILE, 'utf8');
const messages = [];
for (const line of raw.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed) continue;
  try { messages.push(JSON.parse(trimmed)); } catch {}
}
const listResp = messages.find(m => m.id === 2);
const initResp = messages.find(m => m.id === 1);
const serverName = initResp?.result?.serverInfo?.name ?? null;
const toolNames = listResp?.result?.tools?.map(t => t.name) ?? [];
const required = ['persona.get_context', 'conversation.save_turn', 'memory.search', 'memory.inspect'];
const hasAllTools = required.every(n => toolNames.includes(n));
const passed = serverName === 'soulseed' && hasAllTools;
console.log(JSON.stringify({ passed, serverName, toolNames, hasAllTools, messageCount: messages.length }));
VALIDATEEOF
)

echo "[mcp_smoke] Validation: ${VALIDATION_JSON}"

# Write acceptance report
node --input-type=module - > "${REPORT_FILE}" <<REPORTEOF
const v = ${VALIDATION_JSON};
process.stdout.write(JSON.stringify({
  type: 'mcp_smoke',
  runAt: new Date().toISOString(),
  passed: v.passed,
  serverName: v.serverName,
  toolNames: v.toolNames,
  hasAllTools: v.hasAllTools,
  messageCount: v.messageCount
}, null, 2) + '\n');
REPORTEOF

echo "[mcp_smoke] Report: ${REPORT_FILE}"

PASSED_CHECK=$(node --input-type=module - <<CHECKEOF
const v = ${VALIDATION_JSON};
process.exit(v.passed ? 0 : 1);
CHECKEOF
) && PASS_CODE=0 || PASS_CODE=$?

if [ "${PASS_CODE:-0}" -eq 0 ]; then
  echo "[mcp_smoke] PASSED"
  exit 0
else
  echo "[mcp_smoke] FAILED"
  exit 1
fi
