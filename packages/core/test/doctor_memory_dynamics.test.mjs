import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp } from "node:fs/promises";

import { appendLifeEvent, doctorPersona, initPersonaPackage } from "../dist/index.js";

test("doctor rejects invalid memory_weight_updated payload", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-doctor-weight-"));
  const personaPath = path.join(tmpDir, "Roxy.soulseedpersona");

  await initPersonaPackage(personaPath, "Roxy");
  await appendLifeEvent(personaPath, {
    type: "memory_weight_updated",
    payload: {
      oldWeights: { activation: 0.4, emotion: 0.3, narrative: 0.3 },
      newWeights: { activation: 1.2, emotion: -0.1, narrative: 0 }
    }
  });

  const report = await doctorPersona(personaPath);
  assert.equal(report.ok, false);
  assert.equal(report.issues.some((i) => i.code === "invalid_memory_weight_event"), true);
});
