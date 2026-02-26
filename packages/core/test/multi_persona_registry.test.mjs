import { describe, test } from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp, readFile } from "node:fs/promises";

import {
  createDefaultGroupPolicy,
  createDefaultSessionGraph,
  createDefaultSpeakerRegistry,
  ensureMultiPersonaArtifacts,
  initPersonaPackage,
  loadGroupPolicy,
  loadSessionGraph,
  loadSpeakerRegistry,
  registerPersona,
  unregisterPersona,
  lookupPersona,
  seedRegistryEntryFromPersona,
  validateRegistration,
  RegistrationError,
  GROUP_POLICY_FILENAME,
  SESSION_GRAPH_FILENAME,
  SPEAKER_REGISTRY_FILENAME
} from "../dist/index.js";

describe("multi_persona_registry", () => {
  test("default factories produce valid objects", () => {
    const gp = createDefaultGroupPolicy();
    assert.equal(gp.schemaVersion, "1.0");
    assert.equal(gp.arbitrationMode, "addressing_priority");
    assert.equal(gp.isolationLevel, "strict");
    assert.equal(gp.cooperationEnabled, false);
    assert.equal(gp.maxRegisteredPersonas, 8);
    assert.equal(gp.turnScheduling.mode, "round_robin_priority");

    const sg = createDefaultSessionGraph();
    assert.equal(sg.schemaVersion, "1.0");
    assert.deepEqual(sg.sessions, []);

    const sr = createDefaultSpeakerRegistry();
    assert.equal(sr.schemaVersion, "1.0");
    assert.deepEqual(sr.entries, []);
  });

  test("loaders return defaults when files are absent", async () => {
    const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-k-registry-absent-"));
    const personaPath = path.join(tmpDir, "NoK.soulseedpersona");
    await initPersonaPackage(personaPath, "NoK");

    const gp = await loadGroupPolicy(personaPath);
    assert.equal(gp.schemaVersion, "1.0");
    assert.equal(gp.arbitrationMode, "addressing_priority");

    const sg = await loadSessionGraph(personaPath);
    assert.deepEqual(sg.sessions, []);

    const sr = await loadSpeakerRegistry(personaPath);
    assert.deepEqual(sr.entries, []);
  });

  test("ensureMultiPersonaArtifacts creates files idempotently", async () => {
    const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-k-registry-ensure-"));
    const personaPath = path.join(tmpDir, "EnsureK.soulseedpersona");
    await initPersonaPackage(personaPath, "EnsureK");

    const result1 = await ensureMultiPersonaArtifacts(personaPath);
    assert.equal(result1.groupPolicy.schemaVersion, "1.0");

    const gpRaw = await readFile(path.join(personaPath, GROUP_POLICY_FILENAME), "utf8");
    assert.ok(gpRaw.includes('"schemaVersion"'));
    const sgRaw = await readFile(path.join(personaPath, SESSION_GRAPH_FILENAME), "utf8");
    assert.ok(sgRaw.includes('"sessions"'));
    const srRaw = await readFile(path.join(personaPath, SPEAKER_REGISTRY_FILENAME), "utf8");
    assert.ok(srRaw.includes('"entries"'));

    const result2 = await ensureMultiPersonaArtifacts(personaPath);
    assert.equal(result2.groupPolicy.schemaVersion, "1.0");
  });

  test("registerPersona adds entry and rejects duplicates", async () => {
    const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-k-registry-reg-"));
    const personaPath = path.join(tmpDir, "RegK.soulseedpersona");
    await initPersonaPackage(personaPath, "RegK");
    await ensureMultiPersonaArtifacts(personaPath);

    const entry = seedRegistryEntryFromPersona({
      personaId: "p-aster",
      displayName: "Aster"
    });

    const reg1 = await registerPersona(personaPath, entry);
    assert.equal(reg1.entries.length, 1);
    assert.equal(reg1.entries[0].actorId, "p-aster");

    await assert.rejects(
      () => registerPersona(personaPath, entry),
      (err) => err instanceof RegistrationError && err.code === "DUPLICATE_ACTOR_ID"
    );

    const entry2 = { ...entry, actorId: "p-luna", actorLabel: "Luna" };
    await assert.rejects(
      () => registerPersona(personaPath, entry2),
      (err) => err instanceof RegistrationError && err.code === "DUPLICATE_DISPLAY_NAME"
    );
  });

  test("unregisterPersona removes entry", async () => {
    const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-k-registry-unreg-"));
    const personaPath = path.join(tmpDir, "UnregK.soulseedpersona");
    await initPersonaPackage(personaPath, "UnregK");
    await ensureMultiPersonaArtifacts(personaPath);

    const entry = seedRegistryEntryFromPersona({ personaId: "p-x", displayName: "X" });
    await registerPersona(personaPath, entry);

    const reg = await unregisterPersona(personaPath, "p-x");
    assert.equal(reg.entries.length, 0);

    await assert.rejects(
      () => unregisterPersona(personaPath, "p-x"),
      (err) => err instanceof RegistrationError && err.code === "ACTOR_NOT_FOUND"
    );
  });

  test("lookupPersona finds by actorId", () => {
    const registry = createDefaultSpeakerRegistry();
    registry.entries.push({
      actorId: "p-test",
      actorLabel: "Test",
      role: "assistant",
      displayName: "Test",
      registeredAt: new Date().toISOString()
    });

    const found = lookupPersona(registry, "p-test");
    assert.ok(found);
    assert.equal(found.displayName, "Test");
    assert.equal(lookupPersona(registry, "nonexistent"), undefined);
  });

  test("validateRegistration enforces max persona limit", () => {
    const policy = createDefaultGroupPolicy();
    policy.maxRegisteredPersonas = 2;

    const registry = createDefaultSpeakerRegistry();
    registry.entries.push(
      { actorId: "a", actorLabel: "A", role: "assistant", displayName: "A", registeredAt: "" },
      { actorId: "b", actorLabel: "B", role: "assistant", displayName: "B", registeredAt: "" }
    );

    assert.throws(
      () => validateRegistration(registry, {
        actorId: "c", actorLabel: "C", role: "assistant", displayName: "C", registeredAt: ""
      }, policy),
      (err) => err instanceof RegistrationError && err.code === "MAX_PERSONAS_EXCEEDED"
    );
  });

  test("loadPersonaPackage includes K artifact defaults", async () => {
    const { loadPersonaPackage } = await import("../dist/index.js");
    const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-k-registry-load-"));
    const personaPath = path.join(tmpDir, "LoadK.soulseedpersona");
    await initPersonaPackage(personaPath, "LoadK");

    const pkg = await loadPersonaPackage(personaPath);
    assert.ok(pkg.groupPolicy);
    assert.equal(pkg.groupPolicy.schemaVersion, "1.0");
    assert.ok(pkg.sessionGraph);
    assert.deepEqual(pkg.sessionGraph.sessions, []);
    assert.ok(pkg.speakerRegistry);
    assert.deepEqual(pkg.speakerRegistry.entries, []);
  });
});
