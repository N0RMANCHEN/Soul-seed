import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp, readFile } from "node:fs/promises";

import {
  archiveColdMemories,
  ensureMemoryStore,
  initPersonaPackage,
  runMemoryStoreSql
} from "../dist/index.js";

function sqlText(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

test("archiveColdMemories writes segment file and marks memories as archived refs", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-memory-archive-"));
  const personaPath = path.join(tmpDir, "Roxy.soulseedpersona");
  await initPersonaPackage(personaPath, "Roxy");
  await ensureMemoryStore(personaPath);

  const now = new Date();
  const oldIso = new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000).toISOString();
  const createdIso = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString();

  const inserts = [];
  for (let i = 0; i < 12; i += 1) {
    inserts.push(
      [
        "INSERT INTO memories (id, memory_type, content, salience, state, activation_count, last_activated_at, emotion_score, narrative_score, credibility_score, origin_role, evidence_level, excluded_from_recall, reconsolidation_count, source_event_hash, created_at, updated_at, deleted_at)",
        `VALUES (${sqlText(`cold-${i}`)}, 'episodic', ${sqlText(`cold memory ${i}`)}, 0.2, 'cold', 1, ${sqlText(oldIso)}, 0.2, 0.2, 0.9, 'user', 'verified', 0, 0, ${sqlText(`seed:cold:${i}`)}, ${sqlText(createdIso)}, ${sqlText(oldIso)}, NULL);`
      ].join(" ")
    );
  }
  for (let i = 0; i < 8; i += 1) {
    inserts.push(
      [
        "INSERT INTO memories (id, memory_type, content, salience, state, activation_count, last_activated_at, emotion_score, narrative_score, credibility_score, origin_role, evidence_level, excluded_from_recall, reconsolidation_count, source_event_hash, created_at, updated_at, deleted_at)",
        `VALUES (${sqlText(`warm-${i}`)}, 'episodic', ${sqlText(`warm memory ${i}`)}, 0.7, 'warm', 1, ${sqlText(oldIso)}, 0.2, 0.2, 0.9, 'user', 'verified', 0, 0, ${sqlText(`seed:warm:${i}`)}, ${sqlText(createdIso)}, ${sqlText(oldIso)}, NULL);`
      ].join(" ")
    );
  }

  await runMemoryStoreSql(
    personaPath,
    `BEGIN;\n${inserts.join("\n")}\nCOMMIT;`
  );

  const report = await archiveColdMemories(personaPath, {
    minItems: 10,
    minColdRatio: 0.5,
    idleDays: 14,
    maxItems: 100
  });

  assert.equal(report.skippedReason, undefined);
  assert.equal(report.stats.selected, 12);
  assert.equal(report.stats.archived, 12);
  assert.equal(typeof report.segment.segmentKey, "string");

  const segmentRaw = await readFile(report.segment.filePath, "utf8");
  const lines = segmentRaw.split("\n").filter(Boolean);
  assert.equal(lines.length >= 12, true);
  const sample = JSON.parse(lines[0]);
  assert.equal(sample.schema, "soulseed.archive.segment.v1");

  const archivedCountRaw = await runMemoryStoreSql(
    personaPath,
    "SELECT COUNT(*) FROM memories WHERE state='archive' AND excluded_from_recall=1 AND id LIKE 'cold-%';"
  );
  assert.equal(Number(archivedCountRaw.trim()), 12);

  const refRaw = await runMemoryStoreSql(
    personaPath,
    "SELECT content FROM memories WHERE id='cold-0';"
  );
  assert.match(refRaw, /\[archived_ref\]/);

  const segCountRaw = await runMemoryStoreSql(
    personaPath,
    "SELECT COUNT(*) FROM archive_segments WHERE segment_key LIKE 'memory_archive:%';"
  );
  assert.equal(Number(segCountRaw.trim()) >= 1, true);
});

test("archiveColdMemories skips when threshold not reached", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-memory-archive-skip-"));
  const personaPath = path.join(tmpDir, "Roxy.soulseedpersona");
  await initPersonaPackage(personaPath, "Roxy");

  const report = await archiveColdMemories(personaPath, {
    minItems: 999,
    minColdRatio: 0.9,
    idleDays: 14,
    maxItems: 100
  });

  assert.equal(report.stats.eligibleCold, 0);
  assert.equal(report.skippedReason, "below_min_items");
});
