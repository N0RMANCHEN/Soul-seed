import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp, writeFile } from "node:fs/promises";

import { initPersonaPackage, runMemoryStoreSql, buildMemoryEmbeddingIndex, runRecallRegression } from "../dist/index.js";

test("runRecallRegression produces report json", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-memory-eval-"));
  const personaPath = path.join(tmpDir, "Roxy.soulseedpersona");
  const datasetPath = path.join(tmpDir, "dataset.json");
  const outPath = path.join(tmpDir, "report.json");

  await initPersonaPackage(personaPath, "Roxy");
  await runMemoryStoreSql(
    personaPath,
    [
      "INSERT INTO memories",
      "(id, memory_type, content, salience, state, origin_role, evidence_level, activation_count, last_activated_at, emotion_score, narrative_score, credibility_score, excluded_from_recall, reconsolidation_count, source_event_hash, created_at, updated_at, deleted_at)",
      "VALUES ('eval-m-1', 'semantic', '用户偏好：先给结论再给步骤', 0.95, 'warm', 'user', 'verified', 1, '2026-02-18T00:00:00.000Z', 0.2, 0.4, 0.98, 0, 0, 'seed:eval', '2026-02-18T00:00:00.000Z', '2026-02-18T00:00:00.000Z', NULL);"
    ].join(" ")
  );

  await buildMemoryEmbeddingIndex(personaPath, { provider: "local", batchSize: 4 });

  await writeFile(
    datasetPath,
    JSON.stringify(
      {
        name: "smoke-eval",
        cases: [
          {
            id: "q1",
            query: "你记得我的回答习惯吗",
            expectedTerms: ["先给结论再给步骤"]
          }
        ]
      },
      null,
      2
    ),
    "utf8"
  );

  const report = await runRecallRegression(personaPath, datasetPath, {
    k: 5,
    outPath
  });

  assert.equal(report.dataset, "smoke-eval");
  assert.equal(report.scoredCases, 1);
  assert.equal(typeof report.metrics.recallAtK, "number");
  assert.equal(typeof report.metrics.mrr, "number");
  assert.equal(typeof report.metrics.wrongRecallRate, "number");
});
