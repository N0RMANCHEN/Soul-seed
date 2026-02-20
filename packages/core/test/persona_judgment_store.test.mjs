import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp } from "node:fs/promises";

import {
  ensureMemoryStore,
  getActivePersonaJudgment,
  initPersonaPackage,
  runMemoryStoreSql,
  upsertPersonaJudgment
} from "../dist/index.js";

test("upsertPersonaJudgment keeps version history and only one active record", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-judgment-store-"));
  const personaPath = path.join(tmpDir, "Roxy.soulseedpersona");

  await initPersonaPackage(personaPath, "Roxy");
  await ensureMemoryStore(personaPath);

  const first = await upsertPersonaJudgment({
    rootPath: personaPath,
    subjectRef: "turn:1",
    label: "fiction",
    confidence: 0.82,
    rationale: "story_signals",
    evidenceRefs: ["file:///tmp/story.txt"]
  });

  assert.equal(first.version, 1);
  assert.equal(first.active, true);

  const second = await upsertPersonaJudgment({
    rootPath: personaPath,
    subjectRef: "turn:1",
    label: "non_fiction",
    confidence: 0.68,
    rationale: "later_reassessment",
    evidenceRefs: ["https://example.com/article"]
  });

  assert.equal(second.version, 2);
  assert.equal(second.supersedesVersion, 1);

  const active = await getActivePersonaJudgment(personaPath, "turn:1");
  assert.equal(active?.label, "non_fiction");
  assert.equal(active?.version, 2);

  const activeCountRaw = await runMemoryStoreSql(
    personaPath,
    "SELECT COUNT(*) FROM persona_judgments WHERE subject_ref='turn:1' AND is_active=1;"
  );
  assert.equal(Number(activeCountRaw.trim()), 1);

  const totalRaw = await runMemoryStoreSql(
    personaPath,
    "SELECT COUNT(*) FROM persona_judgments WHERE subject_ref='turn:1';"
  );
  assert.equal(Number(totalRaw.trim()), 2);
});
