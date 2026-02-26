import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp, rm, writeFile, readFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";

import {
  initPersonaPackage,
  inspectPersonaPackage,
  exportPersonaPackage,
  importPersonaPackage
} from "../dist/index.js";

// ── helpers ────────────────────────────────────────────────────────────────────

async function makeTmpPersona(name = "Teddy") {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-migration-"));
  const personaPath = path.join(tmpDir, `${name}.soulseedpersona`);
  await initPersonaPackage(personaPath, name);
  return { tmpDir, personaPath };
}

// ── inspect ────────────────────────────────────────────────────────────────────

test("inspectPersonaPackage returns basic fields", async () => {
  const { tmpDir, personaPath } = await makeTmpPersona("Alice");
  try {
    const result = await inspectPersonaPackage(personaPath);
    assert.equal(result.displayName, "Alice");
    assert.equal(typeof result.personaId, "string");
    assert.ok(result.personaId.length > 0);
    assert.equal(typeof result.createdAt, "string");
    assert.ok(result.fileCount > 0);
    assert.ok(result.totalSizeBytes > 0);
    assert.equal(Array.isArray(result.files), true);
    assert.equal(result.files.length, result.fileCount);
  } finally {
    await rm(tmpDir, { recursive: true });
  }
});

test("inspectPersonaPackage includes sha256 for each file", async () => {
  const { tmpDir, personaPath } = await makeTmpPersona("Bob");
  try {
    const result = await inspectPersonaPackage(personaPath);
    for (const f of result.files) {
      assert.equal(typeof f.relativePath, "string");
      assert.ok(f.relativePath.length > 0);
      assert.equal(typeof f.sha256, "string");
      assert.equal(f.sha256.length, 64, `sha256 should be 64 hex chars for ${f.relativePath}`);
      assert.ok(f.sizeBytes >= 0);
    }
  } finally {
    await rm(tmpDir, { recursive: true });
  }
});

test("inspectPersonaPackage counts lifeLogEventCount=0 for fresh persona", async () => {
  const { tmpDir, personaPath } = await makeTmpPersona("Carl");
  try {
    const result = await inspectPersonaPackage(personaPath);
    assert.equal(result.lifeLogEventCount, 0);
  } finally {
    await rm(tmpDir, { recursive: true });
  }
});

test("inspectPersonaPackage throws for non-persona directory", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-not-persona-"));
  try {
    await assert.rejects(() => inspectPersonaPackage(tmpDir), /persona\.json/);
  } finally {
    await rm(tmpDir, { recursive: true });
  }
});

// ── export ─────────────────────────────────────────────────────────────────────

test("exportPersonaPackage creates EXPORT_MANIFEST.json with correct schema", async () => {
  const { tmpDir, personaPath } = await makeTmpPersona("Dana");
  const outDir = path.join(tmpDir, "export");
  try {
    const manifest = await exportPersonaPackage(personaPath, outDir);
    assert.equal(manifest.schema, "soulseed.persona.manifest.v1");
    assert.equal(manifest.displayName, "Dana");
    assert.equal(typeof manifest.personaId, "string");
    assert.ok(manifest.personaId.length > 0);
    assert.ok(manifest.files.length > 0);
    // Verify EXPORT_MANIFEST.json was written (avoids case conflict with manifest.json)
    const manifestPath = path.join(outDir, "EXPORT_MANIFEST.json");
    assert.ok(existsSync(manifestPath), "EXPORT_MANIFEST.json should exist");
    const written = JSON.parse(await readFile(manifestPath, "utf8"));
    assert.equal(written.schema, "soulseed.persona.manifest.v1");
  } finally {
    await rm(tmpDir, { recursive: true });
  }
});

test("exportPersonaPackage copies all persona files", async () => {
  const { tmpDir, personaPath } = await makeTmpPersona("Eve");
  const outDir = path.join(tmpDir, "export");
  try {
    const manifest = await exportPersonaPackage(personaPath, outDir);
    for (const entry of manifest.files) {
      const destFile = path.join(outDir, entry.relativePath);
      assert.ok(existsSync(destFile), `File should exist in export: ${entry.relativePath}`);
    }
    // persona.json must be in export
    assert.ok(existsSync(path.join(outDir, "persona.json")));
  } finally {
    await rm(tmpDir, { recursive: true });
  }
});

test("exportPersonaPackage fails if outPath already exists", async () => {
  const { tmpDir, personaPath } = await makeTmpPersona("Frank");
  const outDir = path.join(tmpDir, "export");
  await mkdir(outDir);
  try {
    await assert.rejects(() => exportPersonaPackage(personaPath, outDir), /已存在/);
  } finally {
    await rm(tmpDir, { recursive: true });
  }
});

// ── import ─────────────────────────────────────────────────────────────────────

test("importPersonaPackage succeeds with valid export", async () => {
  const { tmpDir, personaPath } = await makeTmpPersona("Grace");
  const outDir = path.join(tmpDir, "export");
  const importDir = path.join(tmpDir, "imported");
  try {
    await exportPersonaPackage(personaPath, outDir);
    const result = await importPersonaPackage(outDir, importDir);
    assert.equal(result.ok, true);
    assert.equal(result.displayName, "Grace");
    assert.equal(typeof result.personaId, "string");
    assert.ok(result.filesImported > 0);
    assert.equal(result.errors.length, 0);
    // persona.json should exist in import
    assert.ok(existsSync(path.join(importDir, "persona.json")));
  } finally {
    await rm(tmpDir, { recursive: true });
  }
});

test("importPersonaPackage preserves persona identity after migration", async () => {
  const { tmpDir, personaPath } = await makeTmpPersona("Hana");
  const outDir = path.join(tmpDir, "export");
  const importDir = path.join(tmpDir, "imported");
  try {
    const inspect = await inspectPersonaPackage(personaPath);
    await exportPersonaPackage(personaPath, outDir);
    const result = await importPersonaPackage(outDir, importDir);
    assert.equal(result.ok, true);
    // personaId should be preserved
    assert.equal(result.personaId, inspect.personaId);
    // Verify the imported persona.json has the same id
    const importedPersonaJson = JSON.parse(await readFile(path.join(importDir, "persona.json"), "utf8"));
    assert.equal(importedPersonaJson.id, inspect.personaId);
  } finally {
    await rm(tmpDir, { recursive: true });
  }
});

test("importPersonaPackage fails without EXPORT_MANIFEST.json", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-no-manifest-"));
  const importDir = path.join(tmpDir, "dest");
  try {
    const result = await importPersonaPackage(tmpDir, importDir);
    assert.equal(result.ok, false);
    assert.ok(result.errors.length > 0);
    assert.match(result.errors[0], /EXPORT_MANIFEST/);
  } finally {
    await rm(tmpDir, { recursive: true });
  }
});

test("importPersonaPackage detects file tampering via hash mismatch", async () => {
  const { tmpDir, personaPath } = await makeTmpPersona("Igor");
  const outDir = path.join(tmpDir, "export");
  const importDir = path.join(tmpDir, "imported");
  try {
    await exportPersonaPackage(personaPath, outDir);
    // Tamper with persona.json in export
    await writeFile(path.join(outDir, "persona.json"), '{"id":"tampered"}', "utf8");
    const result = await importPersonaPackage(outDir, importDir);
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.includes("persona.json")));
    // dest should NOT have been created
    assert.equal(existsSync(importDir), false);
  } finally {
    await rm(tmpDir, { recursive: true });
  }
});

test("importPersonaPackage fails if destination already exists", async () => {
  const { tmpDir, personaPath } = await makeTmpPersona("Julia");
  const outDir = path.join(tmpDir, "export");
  const importDir = path.join(tmpDir, "imported");
  await mkdir(importDir);
  try {
    await exportPersonaPackage(personaPath, outDir);
    const result = await importPersonaPackage(outDir, importDir);
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.includes("目标路径已存在")));
  } finally {
    await rm(tmpDir, { recursive: true });
  }
});

test("cross-directory migration: imported persona is independent of source", async () => {
  const { tmpDir, personaPath } = await makeTmpPersona("Kai");
  const outDir = path.join(tmpDir, "export");
  const importDir = path.join(tmpDir, "imported", "Kai.soulseedpersona");
  try {
    await exportPersonaPackage(personaPath, outDir);
    const result = await importPersonaPackage(outDir, importDir);
    assert.equal(result.ok, true);
    // Verify imported persona can be inspected independently
    const importedInspect = await inspectPersonaPackage(importDir);
    assert.equal(importedInspect.displayName, "Kai");
    assert.equal(importedInspect.personaId, result.personaId);
    // Imported files count matches exported files count
    assert.equal(importedInspect.fileCount, result.filesImported);
  } finally {
    await rm(tmpDir, { recursive: true });
  }
});

test("manifest file entries have relative paths (no absolute paths)", async () => {
  const { tmpDir, personaPath } = await makeTmpPersona("Lena");
  const outDir = path.join(tmpDir, "export");
  try {
    const manifest = await exportPersonaPackage(personaPath, outDir);
    for (const entry of manifest.files) {
      assert.ok(!path.isAbsolute(entry.relativePath), `Path should be relative: ${entry.relativePath}`);
    }
  } finally {
    await rm(tmpDir, { recursive: true });
  }
});
