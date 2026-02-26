import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import { existsSync } from "node:fs";

import {
  loadGroupPolicy,
  loadSessionGraph,
  loadSpeakerRegistry,
  ensureMultiPersonaArtifacts,
  migratePersonaToPhaseK,
  createDefaultGroupPolicy,
  GROUP_POLICY_FILENAME,
  SESSION_GRAPH_FILENAME,
  SPEAKER_REGISTRY_FILENAME,
  isPhaseKEnabled,
  PHASE_K_ENV_KEY,
  initPersonaPackage,
  doctorPersona
} from "../dist/index.js";

const ALPHA_PATH = path.resolve("personas/defaults/Alpha.soulseedpersona");

test("legacy persona (no K artifacts): loaders return valid defaults", async () => {
  const gp = await loadGroupPolicy(ALPHA_PATH);
  assert.equal(gp.schemaVersion, "1.0");
  assert.equal(typeof gp.arbitrationMode, "string");
  assert.equal(typeof gp.turnScheduling.maxConsecutiveTurns, "number");

  const sg = await loadSessionGraph(ALPHA_PATH);
  assert.equal(sg.schemaVersion, "1.0");
  assert.ok(Array.isArray(sg.sessions));

  const sr = await loadSpeakerRegistry(ALPHA_PATH);
  assert.equal(sr.schemaVersion, "1.0");
  assert.ok(Array.isArray(sr.entries));
});

test("hybrid persona (partial K artifacts): mixed file+default loading", async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "soulseed-k-hybrid-"));
  const personaPath = path.join(tmpDir, "Hybrid.soulseedpersona");
  await initPersonaPackage(personaPath, "Hybrid");

  const customPolicy = createDefaultGroupPolicy();
  customPolicy.arbitrationMode = "round_robin";
  await fs.writeFile(
    path.join(personaPath, GROUP_POLICY_FILENAME),
    JSON.stringify(customPolicy, null, 2) + "\n",
    "utf8"
  );

  const gp = await loadGroupPolicy(personaPath);
  assert.equal(gp.arbitrationMode, "round_robin");

  const sg = await loadSessionGraph(personaPath);
  assert.equal(sg.schemaVersion, "1.0");
  assert.deepEqual(sg.sessions, []);

  const sr = await loadSpeakerRegistry(personaPath);
  assert.equal(sr.schemaVersion, "1.0");
  assert.deepEqual(sr.entries, []);
});

test("full-K persona: ensureMultiPersonaArtifacts creates all 3 files", async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "soulseed-k-full-"));
  const personaPath = path.join(tmpDir, "FullK.soulseedpersona");
  await initPersonaPackage(personaPath, "FullK");

  const result = await ensureMultiPersonaArtifacts(personaPath);
  assert.equal(result.groupPolicy.schemaVersion, "1.0");
  assert.equal(result.sessionGraph.schemaVersion, "1.0");
  assert.equal(result.speakerRegistry.schemaVersion, "1.0");

  assert.ok(existsSync(path.join(personaPath, GROUP_POLICY_FILENAME)));
  assert.ok(existsSync(path.join(personaPath, SESSION_GRAPH_FILENAME)));
  assert.ok(existsSync(path.join(personaPath, SPEAKER_REGISTRY_FILENAME)));

  const gpLoaded = await loadGroupPolicy(personaPath);
  assert.equal(gpLoaded.schemaVersion, "1.0");
  const sgLoaded = await loadSessionGraph(personaPath);
  assert.equal(sgLoaded.schemaVersion, "1.0");
  const srLoaded = await loadSpeakerRegistry(personaPath);
  assert.equal(srLoaded.schemaVersion, "1.0");
});

test("migration idempotency: second run returns all skipped", async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "soulseed-k-migrate-"));
  const personaPath = path.join(tmpDir, "Migrate.soulseedpersona");
  await initPersonaPackage(personaPath, "Migrate");

  const first = await migratePersonaToPhaseK(personaPath);
  assert.equal(first.created.length, 3);
  assert.equal(first.skipped.length, 0);
  assert.ok(first.created.includes(GROUP_POLICY_FILENAME));
  assert.ok(first.created.includes(SESSION_GRAPH_FILENAME));
  assert.ok(first.created.includes(SPEAKER_REGISTRY_FILENAME));

  const second = await migratePersonaToPhaseK(personaPath);
  assert.equal(second.created.length, 0);
  assert.equal(second.skipped.length, 3);
  assert.ok(second.skipped.includes(GROUP_POLICY_FILENAME));
  assert.ok(second.skipped.includes(SESSION_GRAPH_FILENAME));
  assert.ok(second.skipped.includes(SPEAKER_REGISTRY_FILENAME));
});

test("feature flag off by default", () => {
  const prev = process.env[PHASE_K_ENV_KEY];
  try {
    delete process.env[PHASE_K_ENV_KEY];
    assert.equal(isPhaseKEnabled(), false);

    process.env[PHASE_K_ENV_KEY] = "0";
    assert.equal(isPhaseKEnabled(), false);

    process.env[PHASE_K_ENV_KEY] = "1";
    assert.equal(isPhaseKEnabled(), true);

    process.env[PHASE_K_ENV_KEY] = "true";
    assert.equal(isPhaseKEnabled(), true);

    process.env[PHASE_K_ENV_KEY] = "false";
    assert.equal(isPhaseKEnabled(), false);
  } finally {
    if (prev === undefined) delete process.env[PHASE_K_ENV_KEY];
    else process.env[PHASE_K_ENV_KEY] = prev;
  }
});

test("doctor on legacy persona: no errors from K checks (hints OK)", async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "soulseed-k-doctor-"));
  const personaPath = path.join(tmpDir, "DoctorLegacy.soulseedpersona");
  await initPersonaPackage(personaPath, "DoctorLegacy");

  const report = await doctorPersona(personaPath);
  const kErrors = report.issues.filter(
    (i) => i.code.startsWith("k_") && i.severity === "error"
  );
  assert.equal(kErrors.length, 0, `Unexpected K errors: ${JSON.stringify(kErrors, null, 2)}`);

  const kHints = report.issues.filter(
    (i) => i.code === "k_artifact_missing" && i.severity === "hint"
  );
  assert.equal(kHints.length, 3, "Expected 3 k_artifact_missing hints for legacy persona");
});
