import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { mkdtemp } from "node:fs/promises";

import {
  appendLifeEvent,
  initPersonaPackage,
  runMemoryConsolidation
} from "../dist/index.js";

function sqlite(dbPath, sql) {
  return execFileSync("sqlite3", [dbPath, sql], { encoding: "utf8" }).trim();
}

test("memory consolidation extracts semantic preferences and writes audit event", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-memory-consolidation-"));
  const personaPath = path.join(tmpDir, "Roxy.soulseedpersona");
  const dbPath = path.join(personaPath, "memory.db");
  await initPersonaPackage(personaPath, "Roxy");

  await appendLifeEvent(personaPath, {
    type: "user_message",
    payload: {
      text: "我喜欢你先给结论再给步骤。",
      memoryMeta: {
        tier: "highlight",
        storageCost: 3,
        retrievalCost: 2,
        source: "chat"
      }
    }
  });
  await appendLifeEvent(personaPath, {
    type: "user_message",
    payload: {
      text: "叫我 Hiro 就行。",
      memoryMeta: {
        tier: "highlight",
        storageCost: 3,
        retrievalCost: 2,
        source: "chat"
      }
    }
  });

  const report = await runMemoryConsolidation(personaPath, {
    trigger: "test",
    mode: "light"
  });
  assert.equal(report.ok, true);
  assert.equal(report.inserted >= 1, true);
  assert.equal(typeof report.consolidationRunId, "string");
  assert.equal(Array.isArray(report.pinCandidates), true);

  const semanticCount = Number(
    sqlite(
      dbPath,
      "SELECT COUNT(*) FROM memories WHERE memory_type='semantic' AND content LIKE '用户偏好：%' AND deleted_at IS NULL;"
    )
  );
  assert.equal(semanticCount >= 1, true);

  const eventCount = Number(
    sqlite(
      dbPath,
      "SELECT COUNT(*) FROM memories WHERE source_event_hash LIKE 'consolidated:%' AND deleted_at IS NULL;"
    )
  );
  assert.equal(eventCount >= 1, true);

  const runCount = Number(
    sqlite(dbPath, "SELECT COUNT(*) FROM memory_consolidation_runs;")
  );
  assert.equal(runCount >= 1, true);
});
