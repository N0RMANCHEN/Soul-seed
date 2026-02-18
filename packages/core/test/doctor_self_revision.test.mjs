import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp } from "node:fs/promises";

import { appendLifeEvent, doctorPersona, initPersonaPackage } from "../dist/index.js";

test("doctor rejects invalid self revision payloads", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-doctor-self-revision-"));
  const personaPath = path.join(tmpDir, "Roxy.soulseedpersona");

  await initPersonaPackage(personaPath, "Roxy");

  await appendLifeEvent(personaPath, {
    type: "self_revision_proposed",
    payload: {
      proposal: {
        domain: "habits",
        changes: {},
        evidence: "bad",
        confidence: 2,
        reasonCodes: [],
        conflictsWithBoundaries: [],
        status: "proposed"
      },
      evidenceCount: -1
    }
  });

  const report = await doctorPersona(personaPath);
  assert.equal(report.ok, false);
  assert.equal(report.issues.some((i) => i.code === "invalid_self_revision_proposed_event"), true);
});
