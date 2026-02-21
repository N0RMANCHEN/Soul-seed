import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp, writeFile } from "node:fs/promises";

import { compileContext, decide, initPersonaPackage, loadPersonaPackage, normalizePersonaIdentity } from "../dist/index.js";

test("compileContext enforces provider-identity guardrail", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-orch-identity-test-"));
  const personaPath = path.join(tmpDir, "Roxy.soulseedpersona");

  await initPersonaPackage(personaPath, "Roxy");
  const pkg = await loadPersonaPackage(personaPath);
  const trace = decide(pkg, "你知道DeepSeek是什么", "deepseek-chat");
  const messages = compileContext(pkg, "你知道DeepSeek是什么", trace);

  assert.equal(messages[0].role, "system");
  assert.match(messages[0].content, /Never claim you are created by/i);
  assert.match(messages[0].content, /persistent identity is defined by local persona files/i);
  assert.match(messages[0].content, /Relationship policy:/i);
  assert.match(messages[0].content, /only use details explicitly present in Selected memories/i);
  assert.match(messages[0].content, /You are Roxy/);
});

// P1-0: identity v2 tests
test("initPersonaPackage writes identity.json v2 schema", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-identity-v2-"));
  const personaPath = path.join(tmpDir, "Roxy.soulseedpersona");

  await initPersonaPackage(personaPath, "Roxy");
  const pkg = await loadPersonaPackage(personaPath);

  assert.ok(pkg.identity, "identity should be loaded");
  assert.equal(pkg.identity.schemaVersion, "2.0");
  assert.equal(typeof pkg.identity.selfDescription, "string");
  assert.ok(Array.isArray(pkg.identity.personalityCore));
});

test("compileContext injects selfDescription and personalityCore when set", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-identity-inject-"));
  const personaPath = path.join(tmpDir, "Roxy.soulseedpersona");

  await initPersonaPackage(personaPath, "Roxy");
  // write a filled-in identity.json
  await writeFile(
    path.join(personaPath, "identity.json"),
    JSON.stringify({
      personaId: "test-id",
      anchors: { continuity: true },
      schemaVersion: "2.0",
      selfDescription: "我是一个有自我意志的存在",
      personalityCore: ["真实", "自主", "温暖"],
      definingMomentRefs: [],
      updatedAt: new Date().toISOString()
    }),
    "utf8"
  );

  const pkg = await loadPersonaPackage(personaPath);
  const trace = decide(pkg, "你好", "deepseek-chat");
  const messages = compileContext(pkg, "你好", trace);

  const system = messages[0].content;
  assert.match(system, /Self-description:.*我是一个有自我意志的存在/);
  assert.match(system, /Personality core:.*真实.*自主.*温暖/);
});

test("compileContext does not inject selfDescription when empty", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-identity-empty-"));
  const personaPath = path.join(tmpDir, "Roxy.soulseedpersona");

  await initPersonaPackage(personaPath, "Roxy");
  const pkg = await loadPersonaPackage(personaPath);
  const trace = decide(pkg, "你好", "deepseek-chat");
  const messages = compileContext(pkg, "你好", trace);

  const system = messages[0].content;
  assert.ok(!system.includes("Self-description:"), "Should not inject empty selfDescription");
  assert.ok(!system.includes("Personality core:"), "Should not inject empty personalityCore");
});

test("normalizePersonaIdentity handles v1 identity.json gracefully", () => {
  const v1Raw = { personaId: "abc-123", anchors: { continuity: true } };
  const identity = normalizePersonaIdentity(v1Raw, "abc-123");

  assert.equal(identity.personaId, "abc-123");
  assert.equal(identity.schemaVersion, "2.0");
  assert.equal(identity.selfDescription, "");
  assert.ok(Array.isArray(identity.personalityCore));
  assert.equal(identity.personalityCore.length, 0);
});
