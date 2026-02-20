#!/usr/bin/env node
/**
 * nightly_consolidate.mjs — Full-mode memory consolidation scheduled script
 *
 * Usage:
 *   node scripts/nightly_consolidate.mjs [--persona <path>] [--timeout-ms 30000]
 *
 * Cron setup (run every night at 3am):
 *   0 3 * * * /usr/bin/node /path/to/soulseed/scripts/nightly_consolidate.mjs \
 *     --persona /path/to/personas/MyPersona.soulseedpersona >> /var/log/soulseed-consolidate.log 2>&1
 *
 * Environment variables:
 *   SOULSEED_PERSONA_PATH  — persona directory (overrides --persona)
 *   SOULSEED_TIMEOUT_MS    — consolidation timeout in ms (default: 30000)
 *
 * Exit codes:
 *   0 — success or no-op (nothing to consolidate)
 *   1 — error
 *   2 — consolidation skipped (API key missing, persona not found, etc.)
 */

import { readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

// Parse CLI args
const { values: args } = parseArgs({
  args: process.argv.slice(2),
  options: {
    persona: { type: "string" },
    "timeout-ms": { type: "string" },
    help: { type: "boolean", short: "h" }
  },
  allowPositionals: false
});

if (args.help) {
  console.log("Usage: node scripts/nightly_consolidate.mjs [--persona <path>] [--timeout-ms 30000]");
  process.exit(0);
}

// Resolve persona path
function resolvePersonaPath() {
  const fromEnv = process.env.SOULSEED_PERSONA_PATH?.trim();
  if (fromEnv) return fromEnv;
  if (args.persona) return path.resolve(process.cwd(), args.persona);

  // Auto-discover from ./personas/
  const personasDir = path.resolve(process.cwd(), "./personas");
  if (existsSync(personasDir)) {
    try {
      const entries = readdirSync(personasDir).filter((e) => e.endsWith(".soulseedpersona"));
      if (entries.length > 0) return path.join(personasDir, entries[0]);
    } catch {
      // ignore
    }
  }
  return null;
}

// readdirSync fallback (sync version for auto-discover)
import { readdirSync } from "node:fs";

const personaPath = resolvePersonaPath();
if (!personaPath) {
  console.error("[nightly_consolidate] ERROR: No persona found. Use --persona <path> or set SOULSEED_PERSONA_PATH.");
  process.exit(2);
}

if (!existsSync(personaPath)) {
  console.error(`[nightly_consolidate] ERROR: Persona directory not found: ${personaPath}`);
  process.exit(2);
}

const timeoutMs =
  Number(process.env.SOULSEED_TIMEOUT_MS ?? args["timeout-ms"] ?? "30000");

const startedAt = new Date().toISOString();
console.log(`[nightly_consolidate] START ${startedAt}`);
console.log(`[nightly_consolidate] persona=${personaPath}`);
console.log(`[nightly_consolidate] mode=full timeout=${timeoutMs}ms`);

// Dynamic import to avoid loading all of core at startup
let runMemoryConsolidation;
try {
  const core = await import("@soulseed/core");
  runMemoryConsolidation = core.runMemoryConsolidation;
} catch (err) {
  console.error(`[nightly_consolidate] ERROR: Failed to load @soulseed/core: ${err.message}`);
  process.exit(1);
}

try {
  const result = await runMemoryConsolidation(personaPath, {
    mode: "full",
    trigger: "cron",
    budgetMs: timeoutMs
  });

  const finishedAt = new Date().toISOString();
  console.log(`[nightly_consolidate] DONE ${finishedAt}`);
  console.log(`[nightly_consolidate] stats=${JSON.stringify({
    insertedCount: result.insertedCount,
    skippedCount: result.skippedCount,
    conflictsDetected: result.conflictsDetected,
    conflictRecordsWritten: result.conflictRecordsWritten,
    pinCandidatesCount: result.pinCandidates.length,
    consolidationRunId: result.consolidationRunId
  })}`);

  if (result.pinCandidates.length > 0) {
    console.log(`[nightly_consolidate] pin_candidates:`);
    for (const pin of result.pinCandidates) {
      console.log(`  - ${pin.slice(0, 80)}`);
    }
  }

  process.exit(0);
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`[nightly_consolidate] ERROR: ${msg}`);
  process.exit(1);
}
