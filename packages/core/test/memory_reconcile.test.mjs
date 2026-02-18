import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp } from "node:fs/promises";

import {
  appendLifeEvent,
  initPersonaPackage,
  reconcileMemoryStoreFromLifeLog,
  runMemoryStoreSql
} from "../dist/index.js";

test("reconcileMemoryStoreFromLifeLog returns audit fields and repairs policy drift", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-memory-reconcile-"));
  const personaPath = path.join(tmpDir, "Roxy.soulseedpersona");
  await initPersonaPackage(personaPath, "Roxy");

  const event = await appendLifeEvent(personaPath, {
    type: "assistant_message",
    payload: {
      text: "你之前提到过要优先结论。",
      memoryMeta: {
        tier: "pattern",
        storageCost: 1,
        retrievalCost: 1,
        source: "chat",
        credibilityScore: 0.2,
        excludedFromRecall: true
      }
    }
  });

  await runMemoryStoreSql(
    personaPath,
    `UPDATE memories SET excluded_from_recall=0, credibility_score=0.95 WHERE source_event_hash='${event.hash}';`
  );
  await runMemoryStoreSql(
    personaPath,
    [
      "INSERT INTO memories (id, memory_type, content, salience, state, activation_count, last_activated_at, emotion_score, narrative_score, credibility_score, origin_role, evidence_level, excluded_from_recall, reconsolidation_count, source_event_hash, created_at, updated_at, deleted_at)",
      "VALUES ('ghost-assistant-memory','episodic','ghost',0.3,'warm',1,'2026-01-01T00:00:00.000Z',0.2,0.2,0.9,'assistant','derived',0,0,'ghost-hash','2026-01-01T00:00:00.000Z','2026-01-01T00:00:00.000Z',NULL);"
    ].join(" ")
  );

  const report = await reconcileMemoryStoreFromLifeLog(personaPath);
  assert.equal(typeof report.scannedAssistantEvents, "number");
  assert.equal(typeof report.policyEvents, "number");
  assert.equal(typeof report.matchedRows, "number");
  assert.equal(typeof report.rowsUpdated, "number");
  assert.equal(typeof report.missingRows, "number");
  assert.equal(typeof report.unmappedRows, "number");
  assert.equal(report.rowsUpdated >= 1, true);
  assert.equal(report.unmappedRows >= 1, true);

  const repaired = await runMemoryStoreSql(
    personaPath,
    `SELECT excluded_from_recall || '|' || printf('%.1f', credibility_score) FROM memories WHERE source_event_hash='${event.hash}' LIMIT 1;`
  );
  assert.equal(repaired.trim(), "1|0.2");
});
