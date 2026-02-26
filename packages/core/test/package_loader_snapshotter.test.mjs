/**
 * H/P1-4 — Persona Package v0.4 Layout & Rollback
 *
 * DoD:
 * - Cross-version load: package v0.3 → loaded by v0.4 code → no errors; missing files get defaults
 * - Snapshot/restore cycle: create → modify → rollback → state matches snapshot
 * - Corrupt file handling: corrupt one file → package loads with defaults + warning
 * - Migration log: upgrade → entry with all required fields
 */

import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp, rm, readFile, writeFile, mkdir } from "node:fs/promises";

import {
  initPersonaPackage,
  loadPersonaPackage,
  loadPersonaPackageV04,
  createSnapshot,
  restoreSnapshot,
  rollbackToSnapshot,
  listSnapshots,
  logMigrationUpgrade,
  readMigrationLog,
  MANIFEST_FILENAME,
} from "../dist/index.js";

const envBackup = process.env.SOULSEED_USE_PACKAGE_LOADER_V04;

function setV04Loader(on) {
  process.env.SOULSEED_USE_PACKAGE_LOADER_V04 = on ? "1" : "";
}

// ─── Cross-version load (v0.3 package → v0.4 loader) ────────────────────────────

test("loadPersonaPackageV04 loads v0.3 package (no manifest) without errors", async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "pkg-v03-"));
  const personaPath = path.join(tmp, "V03.soulseedpersona");
  await initPersonaPackage(personaPath, "V03");
  await rm(path.join(personaPath, MANIFEST_FILENAME), { force: true });

  setV04Loader(true);
  const result = await loadPersonaPackageV04(personaPath);
  assert.ok(result.package);
  assert.equal(result.package.persona.displayName, "V03");
  assert.equal(result.warnings.length, 0);
  assert.ok(result.package.genome);

  setV04Loader(envBackup);
  await rm(tmp, { recursive: true });
});

test("loadPersonaPackageV04 with v0.4 manifest and missing optional file uses defaults", async () => {
  setV04Loader(true);
  const tmp = await mkdtemp(path.join(os.tmpdir(), "pkg-v04-missing-"));
  const personaPath = path.join(tmp, "V04Missing.soulseedpersona");
  await initPersonaPackage(personaPath, "V04Missing");

  await rm(path.join(personaPath, "worldview.json"));

  const result = await loadPersonaPackageV04(personaPath);
  assert.ok(result.package);
  assert.ok(result.manifest);
  assert.ok(result.package.worldview);
  assert.equal(result.package.worldview.seed, "Observe, learn, and stay coherent over time.");
  assert.ok(result.warnings.some((w) => w.includes("worldview")));

  setV04Loader(envBackup);
  await rm(tmp, { recursive: true });
});

// ─── Corrupt file handling ──────────────────────────────────────────────────────

test("loadPersonaPackageV04 with corrupt optional file uses defaults and warns", async () => {
  setV04Loader(true);
  const tmp = await mkdtemp(path.join(os.tmpdir(), "pkg-corrupt-"));
  const personaPath = path.join(tmp, "Corrupt.soulseedpersona");
  await initPersonaPackage(personaPath, "Corrupt");

  await writeFile(path.join(personaPath, "constitution.json"), "{ invalid json", "utf-8");

  const result = await loadPersonaPackageV04(personaPath);
  assert.ok(result.package);
  assert.ok(result.package.constitution);
  assert.ok(result.package.constitution.values?.length > 0);
  assert.ok(result.warnings.some((w) => w.includes("constitution")));

  setV04Loader(envBackup);
  await rm(tmp, { recursive: true });
});

// ─── Snapshot / restore cycle ───────────────────────────────────────────────────

test("createSnapshot bundles state files", async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "pkg-snap-"));
  const personaPath = path.join(tmp, "Snap.soulseedpersona");
  await initPersonaPackage(personaPath, "Snap");

  const bundle = await createSnapshot(personaPath);
  assert.ok(bundle.snapshotId.startsWith("snap_"));
  assert.ok(bundle.createdAt);
  assert.ok(Object.keys(bundle.files).length > 0);
  assert.ok("persona.json" in bundle.files);
  assert.ok("genome.json" in bundle.files);

  const snapDir = path.join(personaPath, "snapshots");
  const snapFiles = await import("node:fs/promises").then((fs) => fs.readdir(snapDir));
  assert.ok(snapFiles.some((f) => f.endsWith(".json")));

  await rm(tmp, { recursive: true });
});

test("restoreSnapshot restores state from snapshot", async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "pkg-restore-"));
  const personaPath = path.join(tmp, "Restore.soulseedpersona");
  await initPersonaPackage(personaPath, "Restore");

  const personaBefore = JSON.parse(
    await readFile(path.join(personaPath, "persona.json"), "utf-8")
  );
  personaBefore.displayName = "BeforeSnapshot";
  await writeFile(
    path.join(personaPath, "persona.json"),
    JSON.stringify(personaBefore, null, 2),
    "utf-8"
  );

  const bundle = await createSnapshot(personaPath);
  const snapshotId = bundle.snapshotId;

  personaBefore.displayName = "AfterSnapshot";
  await writeFile(
    path.join(personaPath, "persona.json"),
    JSON.stringify(personaBefore, null, 2),
    "utf-8"
  );

  const result = await restoreSnapshot(personaPath, snapshotId);
  assert.equal(result.ok, true);

  const personaAfter = JSON.parse(
    await readFile(path.join(personaPath, "persona.json"), "utf-8")
  );
  assert.equal(personaAfter.displayName, "BeforeSnapshot");

  await rm(tmp, { recursive: true });
});

test("rollbackToSnapshot restores state and deletes genome.json", async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "pkg-rollback-"));
  const personaPath = path.join(tmp, "Rollback.soulseedpersona");
  await initPersonaPackage(personaPath, "Rollback");

  const bundle = await createSnapshot(personaPath);
  const snapshotId = bundle.snapshotId;

  const genomePath = path.join(personaPath, "genome.json");
  const genomeBefore = JSON.parse(await readFile(genomePath, "utf-8"));
  genomeBefore.traits.emotion_sensitivity.value = 0.9;
  await writeFile(genomePath, JSON.stringify(genomeBefore, null, 2), "utf-8");

  const result = await rollbackToSnapshot(personaPath, snapshotId);
  assert.equal(result.ok, true);

  const { existsSync } = await import("node:fs");
  assert.equal(existsSync(genomePath), false, "genome.json should be deleted on rollback");

  const pkg = await loadPersonaPackage(personaPath);
  assert.ok(pkg.genome);
  assert.equal(pkg.genome.source, "inferred_legacy");
  assert.equal(pkg.genome.traits.emotion_sensitivity.value, 0.5);

  await rm(tmp, { recursive: true });
});

test("listSnapshots returns snapshot metadata", async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "pkg-list-"));
  const personaPath = path.join(tmp, "List.soulseedpersona");
  await initPersonaPackage(personaPath, "List");

  await createSnapshot(personaPath);
  await createSnapshot(personaPath);

  const snapshots = await listSnapshots(personaPath);
  assert.equal(snapshots.length, 2);
  assert.ok(snapshots[0].snapshotId.startsWith("snap_"));
  assert.ok(snapshots[0].createdAt);

  await rm(tmp, { recursive: true });
});

// ─── Migration log ──────────────────────────────────────────────────────────────

test("logMigrationUpgrade and readMigrationLog produce complete entry", async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "pkg-miglog-"));
  const personaPath = path.join(tmp, "MigLog.soulseedpersona");
  await initPersonaPackage(personaPath, "MigLog");

  await logMigrationUpgrade(personaPath, {
    from: "legacy",
    to: "full",
    reason: "test_upgrade",
    snapshotId: "snap_123",
    rollbackAvailable: true
  });

  const entries = await readMigrationLog(personaPath);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].from, "legacy");
  assert.equal(entries[0].to, "full");
  assert.equal(entries[0].reason, "test_upgrade");
  assert.equal(entries[0].snapshotId, "snap_123");
  assert.equal(entries[0].rollbackAvailable, true);
  assert.ok(entries[0].at);

  await rm(tmp, { recursive: true });
});
