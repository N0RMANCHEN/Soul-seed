import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp, readFile } from "node:fs/promises";

import { createChildPersonaFromParent, initPersonaPackage, loadPersonaPackage } from "../dist/index.js";

test("forced reproduction creates child persona and updates lineage", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-reproduce-forced-"));
  const parentPath = path.join(tmpDir, "Parent.soulseedpersona");
  await initPersonaPackage(parentPath, "Parent");
  const parentBefore = await loadPersonaPackage(parentPath);

  const result = await createChildPersonaFromParent({
    parentPath,
    childDisplayName: "Child",
    trigger: "test_force_all",
    forced: true
  });

  const parentAfter = await loadPersonaPackage(parentPath);
  const child = await loadPersonaPackage(result.childPersonaPath);
  assert.equal(parentAfter.soulLineage.childrenPersonaIds.includes(result.childPersonaId), true);
  assert.equal(parentAfter.soulLineage.reproductionCount, parentBefore.soulLineage.reproductionCount + 1);
  assert.equal(child.soulLineage.parentPersonaId, parentAfter.persona.id);
  assert.equal(child.constitution.mission, parentAfter.constitution.mission);

  const childPinnedRaw = JSON.parse(await readFile(path.join(result.childPersonaPath, "pinned.json"), "utf8"));
  assert.equal(Array.isArray(childPinnedRaw.memories), true);
  assert.equal(childPinnedRaw.memories.length <= 8, true);
});
