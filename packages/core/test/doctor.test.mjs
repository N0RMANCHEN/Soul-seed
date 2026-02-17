import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";

import { doctorPersona, initPersonaPackage } from "../dist/index.js";

test("doctor reports missing files", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-doctor-test-"));
  const personaPath = path.join(tmpDir, "Aster.soulseedpersona");

  await initPersonaPackage(personaPath, "Aster");
  await rm(path.join(personaPath, "constitution.json"));

  const result = await doctorPersona(personaPath);
  assert.equal(result.ok, false);
  assert.equal(result.issues[0].code, "missing_file");
});
