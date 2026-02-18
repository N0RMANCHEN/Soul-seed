import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { mkdtemp } from "node:fs/promises";

import { ensureMemoryStore, initPersonaPackage, MEMORY_SCHEMA_VERSION, runMemoryStoreSql } from "../dist/index.js";

function sqlite(dbPath, sql) {
  return execFileSync("sqlite3", [dbPath, sql], { encoding: "utf8" }).trim();
}

test("ensureMemoryStore migrates schema v1 to current schema with new memory columns", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-memory-store-v2-"));
  const personaPath = path.join(tmpDir, "Aster.soulseedpersona");
  const dbPath = path.join(personaPath, "memory.db");

  await initPersonaPackage(personaPath, "Aster");

  await runMemoryStoreSql(
    personaPath,
    `
    BEGIN;
    CREATE TABLE memories_v1_backup AS SELECT id, memory_type, content, salience, state, source_event_hash, created_at, updated_at, deleted_at FROM memories;
    DROP TABLE memories;
    CREATE TABLE memories (
      id TEXT PRIMARY KEY,
      memory_type TEXT NOT NULL,
      content TEXT NOT NULL,
      salience REAL NOT NULL DEFAULT 0,
      state TEXT NOT NULL DEFAULT 'warm',
      source_event_hash TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT
    );
    INSERT INTO memories (id, memory_type, content, salience, state, source_event_hash, created_at, updated_at, deleted_at)
      SELECT id, memory_type, content, salience, state, source_event_hash, created_at, updated_at, deleted_at FROM memories_v1_backup;
    DROP TABLE memories_v1_backup;
    PRAGMA user_version = 1;
    COMMIT;
    `
  );

  await ensureMemoryStore(personaPath);

  const version = sqlite(dbPath, "PRAGMA user_version;");
  assert.equal(version, String(MEMORY_SCHEMA_VERSION));

  const cols = sqlite(
    dbPath,
    "SELECT GROUP_CONCAT(name, ',') FROM pragma_table_info('memories') WHERE name IN ('activation_count','last_activated_at','emotion_score','narrative_score','credibility_score','excluded_from_recall','reconsolidation_count') ORDER BY name;"
  );
  const got = new Set(cols.split(",").filter(Boolean));
  const expected = new Set([
    "activation_count",
    "last_activated_at",
    "emotion_score",
    "narrative_score",
    "credibility_score",
    "excluded_from_recall",
    "reconsolidation_count"
  ]);
  assert.deepEqual(got, expected);
});
