import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp } from "node:fs/promises";

import {
  initPersonaPackage,
  ensureSoulLineageArtifacts,
  loadPersonaPackage,
  updateConsentMode,
  generateReproductionConsentStatement,
  readLifeEvents
} from "../dist/index.js";

test("P5-1: default consentMode is default_consent", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-consent-default-"));
  const personaPath = path.join(tmpDir, "TestConsent.soulseedpersona");
  await initPersonaPackage(personaPath, "TestConsent");
  const pkg = await loadPersonaPackage(personaPath);
  const lineage = await ensureSoulLineageArtifacts(personaPath, pkg.persona.id);
  assert.equal(lineage.consentMode, "default_consent");
});

test("P5-1: updateConsentMode persists require_roxy_voice", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-consent-voice-"));
  const personaPath = path.join(tmpDir, "TestVoice.soulseedpersona");
  await initPersonaPackage(personaPath, "TestVoice");
  const pkg = await loadPersonaPackage(personaPath);

  const updated = await updateConsentMode(personaPath, "require_roxy_voice");
  assert.equal(updated.consentMode, "require_roxy_voice");

  // Persisted
  const lineage = await ensureSoulLineageArtifacts(personaPath, pkg.persona.id);
  assert.equal(lineage.consentMode, "require_roxy_voice");
});

test("P5-1: updateConsentMode persists roxy_veto", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-consent-veto-"));
  const personaPath = path.join(tmpDir, "TestVeto.soulseedpersona");
  await initPersonaPackage(personaPath, "TestVeto");

  const updated = await updateConsentMode(personaPath, "roxy_veto");
  assert.equal(updated.consentMode, "roxy_veto");
});

test("P5-1: generateReproductionConsentStatement records life event", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-consent-stmt-"));
  const personaPath = path.join(tmpDir, "TestStmt.soulseedpersona");
  await initPersonaPackage(personaPath, "TestStmt");

  const statement = await generateReproductionConsentStatement(personaPath, "ChildSoul");
  assert.ok(statement.length > 0, "statement should not be empty");
  assert.ok(statement.includes("ChildSoul"), "statement should mention child name");

  const events = await readLifeEvents(personaPath);
  const consentEvent = events.find((e) => e.type === "reproduction_consent_statement");
  assert.ok(consentEvent, "life event should be recorded");
  assert.equal(consentEvent.payload.childDisplayName, "ChildSoul");
  assert.ok(typeof consentEvent.payload.statement === "string" && consentEvent.payload.statement.length > 0);
});

test("P5-1: normalizeSoulLineage roundtrips new modes", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-consent-rt-"));
  const personaPath = path.join(tmpDir, "TestRT.soulseedpersona");
  await initPersonaPackage(personaPath, "TestRT");
  const pkg = await loadPersonaPackage(personaPath);

  await updateConsentMode(personaPath, "require_roxy_voice");
  const lineage = await ensureSoulLineageArtifacts(personaPath, pkg.persona.id);
  assert.equal(lineage.consentMode, "require_roxy_voice");

  await updateConsentMode(personaPath, "default_consent");
  const lineage2 = await ensureSoulLineageArtifacts(personaPath, pkg.persona.id);
  assert.equal(lineage2.consentMode, "default_consent");
});
