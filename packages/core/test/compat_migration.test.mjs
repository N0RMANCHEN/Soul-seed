import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp, rm, access, readFile, unlink } from "node:fs/promises";

import {
  inferCompatMode,
  hasExplicitGenome,
  useStateDeltaPipeline,
  migrateToFull,
  isMigrated,
  rollbackMigration,
  initPersonaPackage,
  loadPersonaPackage,
} from "../dist/index.js";

// ─── inferCompatMode ────────────────────────────────────────────────────────────

test("inferCompatMode returns legacy for auto-default genome", () => {
  const pkg = { genome: { source: "inferred_legacy" } };
  assert.equal(inferCompatMode(pkg), "legacy");
});

test("inferCompatMode returns legacy when genome is undefined", () => {
  assert.equal(inferCompatMode({}), "legacy");
});

test("inferCompatMode returns full for preset genome", () => {
  const pkg = { genome: { source: "preset" } };
  assert.equal(inferCompatMode(pkg), "full");
});

test("inferCompatMode returns full for migrated genome", () => {
  const pkg = { genome: { source: "migrated" } };
  assert.equal(inferCompatMode(pkg), "full");
});

// ─── useStateDeltaPipeline ──────────────────────────────────────────────────────

test("useStateDeltaPipeline returns true only for full mode", () => {
  assert.equal(useStateDeltaPipeline("full"), true);
  assert.equal(useStateDeltaPipeline("legacy"), false);
});

// ─── hasExplicitGenome ──────────────────────────────────────────────────────────

test("hasExplicitGenome detects genome.json presence", async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "compat-has-"));
  const personaPath = path.join(tmp, "Test.soulseedpersona");
  await initPersonaPackage(personaPath, "Test");

  assert.equal(hasExplicitGenome(personaPath), true);

  await unlink(path.join(personaPath, "genome.json"));
  assert.equal(hasExplicitGenome(personaPath), false);

  await rm(tmp, { recursive: true });
});

// ─── migrateToFull ──────────────────────────────────────────────────────────────

test("migrateToFull creates genome.json, epigenetics.json, snapshot, and backup", async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "compat-migrate-"));
  const personaPath = path.join(tmp, "M1.soulseedpersona");
  await initPersonaPackage(personaPath, "M1");

  const result = await migrateToFull(personaPath);
  assert.equal(result.success, true);
  assert.equal(result.errors.length, 0);

  await access(path.join(personaPath, "genome.json"));
  await access(path.join(personaPath, "epigenetics.json"));
  await access(path.join(personaPath, "migration_snapshot.json"));

  const snap = JSON.parse(await readFile(path.join(personaPath, "migration_snapshot.json"), "utf-8"));
  assert.equal(snap.fromMode, "legacy");
  assert.equal(snap.toMode, "full");
  assert.ok(snap.backupPaths.length > 0);

  const genome = JSON.parse(await readFile(path.join(personaPath, "genome.json"), "utf-8"));
  assert.equal(genome.source, "migrated");

  await rm(tmp, { recursive: true });
});

// ─── isMigrated ─────────────────────────────────────────────────────────────────

test("isMigrated returns false before and true after migration", async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "compat-ismig-"));
  const personaPath = path.join(tmp, "M2.soulseedpersona");
  await initPersonaPackage(personaPath, "M2");

  assert.equal(await isMigrated(personaPath), false);
  await migrateToFull(personaPath);
  assert.equal(await isMigrated(personaPath), true);

  await rm(tmp, { recursive: true });
});

// ─── Idempotency ────────────────────────────────────────────────────────────────

test("migrateToFull is idempotent", async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "compat-idem-"));
  const personaPath = path.join(tmp, "M3.soulseedpersona");
  await initPersonaPackage(personaPath, "M3");

  const r1 = await migrateToFull(personaPath);
  assert.equal(r1.success, true);

  const r2 = await migrateToFull(personaPath);
  assert.equal(r2.success, true);

  await rm(tmp, { recursive: true });
});

// ─── Rollback ───────────────────────────────────────────────────────────────────

test("rollbackMigration restores original state", async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "compat-rollback-"));
  const personaPath = path.join(tmp, "M4.soulseedpersona");
  await initPersonaPackage(personaPath, "M4");

  const origGenome = JSON.parse(await readFile(path.join(personaPath, "genome.json"), "utf-8"));
  assert.equal(origGenome.source, "preset");

  await migrateToFull(personaPath);
  const migratedGenome = JSON.parse(await readFile(path.join(personaPath, "genome.json"), "utf-8"));
  assert.equal(migratedGenome.source, "migrated");

  const rolled = await rollbackMigration(personaPath);
  assert.equal(rolled, true);

  const restoredGenome = JSON.parse(await readFile(path.join(personaPath, "genome.json"), "utf-8"));
  assert.equal(restoredGenome.source, "preset");

  assert.equal(await isMigrated(personaPath), false);

  await rm(tmp, { recursive: true });
});
