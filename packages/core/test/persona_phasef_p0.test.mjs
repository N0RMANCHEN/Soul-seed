import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp, readFile, rm, unlink, writeFile } from "node:fs/promises";

import {
  MAX_PINNED_CHARS,
  addLibraryBlock,
  compileAlwaysInjectContext,
  compilePersonaSnapshot,
  formatAlwaysInjectContext,
  getMemoryStoreDriver,
  getUserFacts,
  initPersonaPackage,
  lintPersona,
  loadPersonaPackage,
  setMemoryStoreDriver
} from "../dist/index.js";

test("persona lint strict mode upgrades pinned length warning to error", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-p0-lint-"));
  try {
    const personaPath = path.join(tmpDir, "Roxy.soulseedpersona");
    await initPersonaPackage(personaPath, "Roxy");

    const pinnedPath = path.join(personaPath, "pinned.json");
    const pinned = JSON.parse(await readFile(pinnedPath, "utf8"));
    pinned.memories = ["x".repeat(MAX_PINNED_CHARS + 20)];
    await writeFile(pinnedPath, `${JSON.stringify(pinned, null, 2)}\n`, "utf8");

    const nonStrict = await lintPersona(personaPath, { strict: false });
    assert.equal(nonStrict.errorCount, 0);
    assert.ok(nonStrict.warningCount >= 1);

    const strict = await lintPersona(personaPath, { strict: true });
    assert.ok(strict.errorCount >= 1);
    assert.ok(strict.issues.some((x) => x.code === "pinned_char_exceeded" && x.level === "error"));
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
});

test("persona compile produces stable hash for same input", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-p0-compile-"));
  try {
    const personaPath = path.join(tmpDir, "Teddy.soulseedpersona");
    await initPersonaPackage(personaPath, "Teddy");

    const out1 = path.join(tmpDir, "compiled-1.json");
    const out2 = path.join(tmpDir, "compiled-2.json");

    const first = await compilePersonaSnapshot(personaPath, { outPath: out1 });
    const second = await compilePersonaSnapshot(personaPath, { outPath: out2 });

    assert.equal(first.snapshot.hash, second.snapshot.hash);
    assert.notEqual(first.snapshot.compiledAt, second.snapshot.compiledAt);
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
});

test("persona compile fails when required files are missing", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-p0-compile-fail-"));
  try {
    const personaPath = path.join(tmpDir, "Luna.soulseedpersona");
    await initPersonaPackage(personaPath, "Luna");
    await unlink(path.join(personaPath, "identity.json"));

    await assert.rejects(() => compilePersonaSnapshot(personaPath), /persona lint failed/);
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
});

test("always inject context includes relevant persona library blocks", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-p0-library-"));
  try {
    const personaPath = path.join(tmpDir, "Mila.soulseedpersona");
    await initPersonaPackage(personaPath, "Mila");
    await addLibraryBlock(personaPath, {
      title: "Emotion Layer Separation",
      content: "Keep affect state independent from relationship state and gate projections.",
      tags: ["emotion", "affect", "architecture"]
    });
    await addLibraryBlock(personaPath, {
      title: "Genome Guard",
      content: "Genome traits must not directly rewrite runtime emotional latents.",
      tags: ["genome", "guard", "safety"]
    });

    const personaPkg = await loadPersonaPackage(personaPath);
    const ctx = await compileAlwaysInjectContext(personaPath, personaPkg, {
      query: "emotion genome guard"
    });
    assert.ok((ctx.libraryBlocks?.length ?? 0) >= 1);

    const formatted = formatAlwaysInjectContext(ctx);
    assert.match(formatted, /Persona library:/);
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
});

test("memory store driver can be swapped for user facts path", async () => {
  const previous = getMemoryStoreDriver();
  let calls = 0;
  try {
    setMemoryStoreDriver({
      async runSql() {
        calls += 1;
        return "";
      }
    });
    const facts = await getUserFacts("/tmp/non-existent-persona");
    assert.deepEqual(facts, []);
    assert.ok(calls >= 1);
  } finally {
    setMemoryStoreDriver(previous);
  }
});
