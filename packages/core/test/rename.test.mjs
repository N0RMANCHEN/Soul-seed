import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp } from "node:fs/promises";

import {
  applyRename,
  findLatestRenameRequest,
  getLastRenameAppliedAt,
  getRenameCooldownStatus,
  initPersonaPackage,
  loadPersonaPackage,
  requestRename,
  validateDisplayName
} from "../dist/index.js";

test("rename applies with personaId unchanged", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-rename-test-"));
  const personaPath = path.join(tmpDir, "Roxy.soulseedpersona");

  await initPersonaPackage(personaPath, "Roxy");
  const before = await loadPersonaPackage(personaPath);

  await requestRename(personaPath, {
    oldDisplayName: "Roxy",
    newDisplayName: "Nova",
    trigger: "user"
  });

  const applied = await applyRename(personaPath, {
    newDisplayName: "Nova",
    trigger: "user",
    confirmedByUser: true
  });

  const after = await loadPersonaPackage(personaPath);
  assert.equal(applied.oldDisplayName, "Roxy");
  assert.equal(applied.newDisplayName, "Nova");
  assert.equal(after.persona.displayName, "Nova");
  assert.equal(before.persona.id, after.persona.id);
});

test("rename cooldown blocks immediate second rename", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-rename-cooldown-test-"));
  const personaPath = path.join(tmpDir, "Roxy.soulseedpersona");

  await initPersonaPackage(personaPath, "Roxy");
  await requestRename(personaPath, {
    oldDisplayName: "Roxy",
    newDisplayName: "Nova",
    trigger: "user"
  });
  await applyRename(personaPath, {
    newDisplayName: "Nova",
    trigger: "user",
    confirmedByUser: true
  });

  const lastAppliedAt = await getLastRenameAppliedAt(personaPath);
  const status = getRenameCooldownStatus(lastAppliedAt, Date.now());

  assert.equal(status.allowed, false);
  assert.ok(status.remainingMs > 0);
});

test("latest rename request is discoverable", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-rename-request-test-"));
  const personaPath = path.join(tmpDir, "Roxy.soulseedpersona");

  await initPersonaPackage(personaPath, "Roxy");
  await requestRename(personaPath, {
    oldDisplayName: "Roxy",
    newDisplayName: "Nova",
    trigger: "user"
  });

  const request = await findLatestRenameRequest(personaPath, "Nova");
  assert.ok(request);
  assert.equal(request.payload.newDisplayName, "Nova");
});

test("name validation rejects invalid chars", () => {
  const result = validateDisplayName("Roxy !!!");
  assert.equal(result.ok, false);
});
