import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp } from "node:fs/promises";

import { appendLifeEvent, doctorPersona, initPersonaPackage } from "../dist/index.js";

test("doctor rejects invalid narrative_drift_detected payload", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-doctor-narrative-"));
  const personaPath = path.join(tmpDir, "Roxy.soulseedpersona");

  await initPersonaPackage(personaPath, "Roxy");
  await appendLifeEvent(personaPath, {
    type: "narrative_drift_detected",
    payload: {
      score: 3,
      reasons: "not-array"
    }
  });

  const report = await doctorPersona(personaPath);
  assert.equal(report.ok, false);
  assert.equal(report.issues.some((i) => i.code === "invalid_narrative_drift_event"), true);
});
