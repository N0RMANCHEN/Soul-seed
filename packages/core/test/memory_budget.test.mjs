import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp } from "node:fs/promises";

import {
  initPersonaPackage,
  inspectMemoryBudget,
  runMemoryBudgetBenchmark,
  runMemoryStoreSql
} from "../dist/index.js";

test("inspectMemoryBudget returns db size and yearly projection", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-memory-budget-"));
  const personaPath = path.join(tmpDir, "Roxy.soulseedpersona");
  await initPersonaPackage(personaPath, "Roxy");

  const now = new Date();
  const oldIso = new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000).toISOString();
  const newIso = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString();

  await runMemoryStoreSql(
    personaPath,
    [
      "BEGIN;",
      "INSERT INTO memories (id, memory_type, content, salience, state, activation_count, last_activated_at, emotion_score, narrative_score, credibility_score, origin_role, evidence_level, excluded_from_recall, reconsolidation_count, source_event_hash, created_at, updated_at, deleted_at)",
      `VALUES ('budget-1','episodic','budget memory one',0.5,'warm',1,'${oldIso}',0.2,0.2,0.9,'user','verified',0,0,'seed:budget:1','${oldIso}','${oldIso}',NULL);`,
      "INSERT INTO memories (id, memory_type, content, salience, state, activation_count, last_activated_at, emotion_score, narrative_score, credibility_score, origin_role, evidence_level, excluded_from_recall, reconsolidation_count, source_event_hash, created_at, updated_at, deleted_at)",
      `VALUES ('budget-2','episodic','budget memory two',0.5,'archive',1,'${newIso}',0.2,0.2,0.9,'user','verified',1,0,'seed:budget:2','${newIso}','${newIso}',NULL);`,
      "COMMIT;"
    ].join("\n")
  );

  const snapshot = await inspectMemoryBudget(personaPath);
  assert.equal(snapshot.rows.total >= 2, true);
  assert.equal(snapshot.rows.archived >= 1, true);
  assert.equal(snapshot.dbMb >= 0, true);
  assert.equal(snapshot.horizon.projectedYearDbMb >= 0, true);
});

test("runMemoryBudgetBenchmark outputs growth curve and cache stats", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-memory-budget-benchmark-"));
  const personaPath = path.join(tmpDir, "Roxy.soulseedpersona");
  await initPersonaPackage(personaPath, "Roxy");

  const report = await runMemoryBudgetBenchmark(personaPath, {
    targetMb: 300,
    days: 14,
    eventsPerDay: 4,
    recallQueries: 12,
    growthCheckpoints: 4
  });

  assert.equal(report.storage.rowsInserted > 0, true);
  assert.equal(Array.isArray(report.storage.growthCurve), true);
  assert.equal(report.storage.growthCurve.length >= 2, true);
  assert.equal(typeof report.cache.hitRate, "number");
  assert.equal(typeof report.process.under64Mb, "boolean");
});
