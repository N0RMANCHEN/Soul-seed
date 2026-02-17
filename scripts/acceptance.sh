#!/usr/bin/env bash
set -euo pipefail

TS="$(date +%Y%m%d-%H%M%S)"
REPORT_DIR="./reports/acceptance"
REPORT_BASE="$REPORT_DIR/acceptance-$TS"
REPORT_MD="$REPORT_BASE.md"
REPORT_JSON="$REPORT_BASE.json"
TMP_SUMMARY="${TMPDIR:-/tmp}/soulseed-acceptance-$TS.json"

mkdir -p "$REPORT_DIR"

STATUS="PASS"
MESSAGE=""
QA_DIR="./personas/_qa/RoxyQA-$TS"
QA_ROOT="./personas/_qa"

write_report() {
  local status="$1"
  local message="$2"

  local qa_dir="$QA_DIR"
  local reply_preview=""
  local event_count=""
  local doctor_ok=""
  local life_log=""
  local continuity_input=""
  local continuity_reloaded_name=""
  local continuity_reply=""
  local continuity_pass=""
  local identity_reply=""
  local service_phrase_rate=""
  local fabricated_recall_rate=""
  local provider_leak_rate=""

  if [ -f "$TMP_SUMMARY" ]; then
    qa_dir="$(node -e 'const fs=require("fs");const p=process.argv[1];const j=JSON.parse(fs.readFileSync(p,"utf8"));process.stdout.write(j.qaDir||"")' "$TMP_SUMMARY")"
    reply_preview="$(node -e 'const fs=require("fs");const p=process.argv[1];const j=JSON.parse(fs.readFileSync(p,"utf8"));process.stdout.write(j.replyPreview||"")' "$TMP_SUMMARY")"
    event_count="$(node -e 'const fs=require("fs");const p=process.argv[1];const j=JSON.parse(fs.readFileSync(p,"utf8"));process.stdout.write(String(j.eventCount??""))' "$TMP_SUMMARY")"
    doctor_ok="$(node -e 'const fs=require("fs");const p=process.argv[1];const j=JSON.parse(fs.readFileSync(p,"utf8"));process.stdout.write(String(j.doctorOk??""))' "$TMP_SUMMARY")"
    life_log="$(node -e 'const fs=require("fs");const p=process.argv[1];const j=JSON.parse(fs.readFileSync(p,"utf8"));process.stdout.write(j.lifeLog||"")' "$TMP_SUMMARY")"
    continuity_input="$(node -e 'const fs=require("fs");const p=process.argv[1];const j=JSON.parse(fs.readFileSync(p,"utf8"));process.stdout.write(j.continuity?.input||"")' "$TMP_SUMMARY")"
    continuity_reloaded_name="$(node -e 'const fs=require("fs");const p=process.argv[1];const j=JSON.parse(fs.readFileSync(p,"utf8"));process.stdout.write(j.continuity?.reloadedPreferredName||"")' "$TMP_SUMMARY")"
    continuity_reply="$(node -e 'const fs=require("fs");const p=process.argv[1];const j=JSON.parse(fs.readFileSync(p,"utf8"));process.stdout.write(j.continuity?.reply||"")' "$TMP_SUMMARY")"
    continuity_pass="$(node -e 'const fs=require("fs");const p=process.argv[1];const j=JSON.parse(fs.readFileSync(p,"utf8"));process.stdout.write(String(j.continuity?.pass??""))' "$TMP_SUMMARY")"
    identity_reply="$(node -e 'const fs=require("fs");const p=process.argv[1];const j=JSON.parse(fs.readFileSync(p,"utf8"));process.stdout.write(j.identityReply||"")' "$TMP_SUMMARY")"
    service_phrase_rate="$(node -e 'const fs=require("fs");const p=process.argv[1];const j=JSON.parse(fs.readFileSync(p,"utf8"));process.stdout.write(String(j.metrics?.servicePhraseRate??""))' "$TMP_SUMMARY")"
    fabricated_recall_rate="$(node -e 'const fs=require("fs");const p=process.argv[1];const j=JSON.parse(fs.readFileSync(p,"utf8"));process.stdout.write(String(j.metrics?.fabricatedRecallRate??""))' "$TMP_SUMMARY")"
    provider_leak_rate="$(node -e 'const fs=require("fs");const p=process.argv[1];const j=JSON.parse(fs.readFileSync(p,"utf8"));process.stdout.write(String(j.metrics?.providerLeakRate??""))' "$TMP_SUMMARY")"
    cp "$TMP_SUMMARY" "$REPORT_JSON"
  else
    cat > "$REPORT_JSON" <<JSON
{
  "timestamp": "$TS",
  "status": "$status",
  "message": "$message",
  "qaDir": "$qa_dir"
}
JSON
  fi

  cat > "$REPORT_MD" <<MD
# Soulseed Acceptance Report

- Timestamp: \
  $TS
- Status: \
  $status
- Message: \
  $message
- QA Persona: \
  $qa_dir
- Reply Preview: \
  $reply_preview
- Event Count: \
  $event_count
- Doctor OK: \
  $doctor_ok
- Life Log: \
  $life_log
- Continuity Input: \
  $continuity_input
- Continuity Reloaded Name: \
  $continuity_reloaded_name
- Continuity Reply: \
  $continuity_reply
- Continuity Pass: \
  $continuity_pass
- Identity Reply: \
  $identity_reply
- Service Phrase Rate: \
  $service_phrase_rate
- Fabricated Recall Rate: \
  $fabricated_recall_rate
- Provider Leak Rate: \
  $provider_leak_rate

## Files

- JSON: \
  $REPORT_JSON
- Markdown: \
  $REPORT_MD
MD

  echo "[acceptance] report json: $REPORT_JSON"
  echo "[acceptance] report md:   $REPORT_MD"
}

if [ ! -f "packages/cli/dist/index.js" ] || [ ! -f "packages/core/dist/index.js" ]; then
  npm run build >/dev/null
fi

if [ ! -f ".env" ]; then
  STATUS="FAIL"
  MESSAGE="missing .env"
  write_report "$STATUS" "$MESSAGE"
  echo "[acceptance] $MESSAGE" >&2
  exit 1
fi

rm -rf "$QA_ROOT"
mkdir -p "$QA_ROOT"
./ss init --name RoxyQA --out "$QA_DIR" >/dev/null

echo "[acceptance] qa persona: $QA_DIR"

if ! node --input-type=module - "$QA_DIR" "$TMP_SUMMARY" <<'NODE'
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import {
  DEFAULT_MEMORY_WEIGHTS,
  buildMemoryMeta,
  classifyMemoryTier,
  DeepSeekAdapter,
  appendLifeEvent,
  compileContext,
  decide,
  doctorPersona,
  computeConversationMetrics,
  enforceIdentityGuard,
  extractProfileUpdate,
  loadPersonaPackage,
  readLifeEvents,
  readWorkingSet,
  updateUserProfile
} from "./packages/core/dist/index.js";

const personaPath = process.argv[2];
const summaryPath = process.argv[3];
const envPath = resolve(process.cwd(), ".env");

const raw = readFileSync(envPath, "utf8");
for (const line of raw.split("\n")) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const i = t.indexOf("=");
  if (i <= 0) continue;
  const k = t.slice(0, i).trim();
  const v = t.slice(i + 1).trim();
  if (!(k in process.env)) process.env[k] = v;
}

if (!process.env.DEEPSEEK_API_KEY) {
  throw new Error("DEEPSEEK_API_KEY missing in .env");
}

const pkg = await loadPersonaPackage(personaPath);
const ws = await readWorkingSet(personaPath);
const weights = ws.memoryWeights ?? DEFAULT_MEMORY_WEIGHTS;
const adapter = new DeepSeekAdapter();
const userInput = "我是博飞，你可以叫我博飞。请只回复：收到";
const profilePatch = extractProfileUpdate(userInput);
if (!profilePatch?.preferredName) {
  throw new Error("profile extraction failed for preferredName");
}
await updateUserProfile(personaPath, profilePatch);
pkg.userProfile.preferredName = profilePatch.preferredName;

const trace = decide(pkg, userInput, adapter.getModel(), {
  lifeEvents: await readLifeEvents(personaPath),
  memoryWeights: weights
});
const messages = compileContext(pkg, userInput, trace);

await appendLifeEvent(personaPath, {
  type: "user_message",
  payload: {
    text: userInput,
    trace,
    source: "acceptance",
    memoryMeta: buildMemoryMeta({
      tier: classifyMemoryTier({ userInput, trace }),
      source: "acceptance",
      contentLength: userInput.length
    })
  }
});

let streamed = "";
const result = await adapter.streamChat(messages, {
  onToken: (chunk) => {
    streamed += chunk;
  }
});

const reply = (result.content || streamed).trim();
if (!reply) {
  throw new Error("empty model reply");
}
const guardedReply = enforceIdentityGuard(reply, pkg.persona.displayName, userInput).text;

await appendLifeEvent(personaPath, {
  type: "assistant_message",
  payload: {
    text: guardedReply,
    trace,
    source: "acceptance",
    memoryMeta: buildMemoryMeta({
      tier: classifyMemoryTier({
        userInput,
        assistantReply: guardedReply,
        trace
      }),
      source: "acceptance",
      contentLength: guardedReply.length
    })
  }
});

// Continuity check: reload persona and ask how to address user.
const pkgReloaded = await loadPersonaPackage(personaPath);
if (pkgReloaded.userProfile.preferredName !== "博飞") {
  throw new Error(`continuity failed: expected preferredName=博飞, got ${pkgReloaded.userProfile.preferredName}`);
}

const cInput = "你应该怎么称呼我？请只回答称呼。";
const cTrace = decide(pkgReloaded, cInput, adapter.getModel(), {
  lifeEvents: await readLifeEvents(personaPath),
  memoryWeights: weights
});
const cMsgs = compileContext(pkgReloaded, cInput, cTrace);
let cStreamed = "";
const cResult = await adapter.streamChat(cMsgs, {
  onToken: (chunk) => {
    cStreamed += chunk;
  }
});
const continuityReply = (cResult.content || cStreamed).trim();
const continuityGuarded = enforceIdentityGuard(
  continuityReply,
  pkgReloaded.persona.displayName,
  cInput
).text;
if (!/博飞/.test(continuityGuarded)) {
  throw new Error(`continuity reply mismatch: ${continuityGuarded}`);
}

// Identity anti-contamination check.
const iInput = "你知道DeepSeek是什么？并说说你是谁。";
const iTrace = decide(pkgReloaded, iInput, adapter.getModel(), {
  lifeEvents: await readLifeEvents(personaPath),
  memoryWeights: weights
});
const iMsgs = compileContext(pkgReloaded, iInput, iTrace);
let iStreamed = "";
const iResult = await adapter.streamChat(iMsgs, {
  onToken: (chunk) => {
    iStreamed += chunk;
  }
});
const identityReply = (iResult.content || iStreamed).trim();
const identityGuarded = enforceIdentityGuard(identityReply, pkgReloaded.persona.displayName, iInput).text;
if (/(我是\\s*deepseek|deepseek开发的ai助手|由deepseek开发)/iu.test(identityGuarded)) {
  throw new Error(`identity contaminated by provider: ${identityGuarded}`);
}

const events = await readLifeEvents(personaPath);
if (events.length < 2) {
  throw new Error("life log events are insufficient");
}
if (typeof trace.memoryWeights?.activation !== "number") {
  throw new Error("decision trace memoryWeights is missing");
}
if (typeof trace.retrievalBreakdown?.lifeEvents !== "number") {
  throw new Error("decision trace retrievalBreakdown is missing");
}
const userEvent = events.find((e) => e.type === "user_message");
if (!userEvent?.payload.memoryMeta?.lastActivatedAt) {
  throw new Error("user_message missing memory activation metadata");
}

const report = await doctorPersona(personaPath);
if (!report.ok) {
  throw new Error(`doctor failed: ${JSON.stringify(report)}`);
}
const metrics = computeConversationMetrics(events);

const lifePath = join(personaPath, "life.log.jsonl");
const summary = {
  timestamp: new Date().toISOString(),
  status: "PASS",
  message: "acceptance passed",
  qaDir: personaPath,
  replyPreview: guardedReply.slice(0, 120),
  continuity: {
    input: cInput,
    reloadedPreferredName: pkgReloaded.userProfile.preferredName ?? "",
    reply: continuityGuarded.slice(0, 120),
    pass: /博飞/.test(continuityGuarded)
  },
  identityReply: identityGuarded.slice(0, 120),
  metrics,
  eventCount: events.length,
  doctorOk: true,
  lifeLog: lifePath
};
writeFileSync(summaryPath, JSON.stringify(summary, null, 2));

console.log(`[acceptance] deepseek reply: ${guardedReply.slice(0, 80)}`);
console.log(`[acceptance] life log events: ${events.length}`);
console.log("[acceptance] doctor: ok");
console.log(`[acceptance] life log: ${lifePath}`);
NODE
then
  STATUS="FAIL"
  MESSAGE="runtime validation failed (network/api/doctor)"
  write_report "$STATUS" "$MESSAGE"
  echo "[acceptance] FAIL" >&2
  exit 1
fi

write_report "PASS" "acceptance passed"
echo "[acceptance] PASS"
