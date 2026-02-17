import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp, rm, writeFile } from "node:fs/promises";

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

test("doctor reports mission drift as warning", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-doctor-test-"));
  const personaPath = path.join(tmpDir, "Aster.soulseedpersona");

  await initPersonaPackage(personaPath, "Aster");
  await writeFile(
    path.join(personaPath, "constitution.json"),
    JSON.stringify(
      {
        values: ["honesty", "helpfulness", "continuity"],
        boundaries: ["no fabricated facts", "respect user constraints"],
        mission: "Be a consistent long-lived assistant."
      },
      null,
      2
    ) + "\n",
    "utf8"
  );

  const result = await doctorPersona(personaPath);
  const issue = result.issues.find((item) => item.code === "mission_drift");
  assert.ok(issue);
  assert.equal(issue.severity, "warning");
});
