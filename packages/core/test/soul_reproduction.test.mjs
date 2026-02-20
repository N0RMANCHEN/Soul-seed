import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";

import {
  initPersonaPackage,
  loadPersonaPackage,
  appendLifeEvent,
  createChildPersonaFromParent,
  extractSpiritualLegacy,
  MAX_REPRODUCTION_COUNT,
  ensureSoulLineageArtifacts
} from "../dist/index.js";

// ── helpers ────────────────────────────────────────────────────────────────────

async function makeTmpPersona(name = "Parent") {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-repro-"));
  const personaPath = path.join(tmpDir, `${name}.soulseedpersona`);
  await initPersonaPackage(personaPath, name);
  return { tmpDir, personaPath };
}

// ── extractSpiritualLegacy ────────────────────────────────────────────────────

test("extractSpiritualLegacy returns empty string for fresh persona", async () => {
  const { tmpDir, personaPath } = await makeTmpPersona();
  try {
    const legacy = await extractSpiritualLegacy(personaPath);
    assert.equal(typeof legacy, "string");
    assert.equal(legacy, "");
  } finally {
    await rm(tmpDir, { recursive: true });
  }
});

test("extractSpiritualLegacy extracts from assistant messages", async () => {
  const { tmpDir, personaPath } = await makeTmpPersona();
  try {
    await appendLifeEvent(personaPath, {
      type: "assistant_message",
      payload: { text: "我喜欢和你一起思考深刻的问题", proactive: false }
    });
    await appendLifeEvent(personaPath, {
      type: "assistant_message",
      payload: { text: "每一次对话都让我学到新的东西", proactive: false }
    });
    const legacy = await extractSpiritualLegacy(personaPath);
    assert.ok(legacy.length > 0);
    assert.ok(legacy.includes("我喜欢") || legacy.includes("每一次"));
  } finally {
    await rm(tmpDir, { recursive: true });
  }
});

test("extractSpiritualLegacy skips proactive messages", async () => {
  const { tmpDir, personaPath } = await makeTmpPersona();
  try {
    await appendLifeEvent(personaPath, {
      type: "assistant_message",
      payload: { text: "主动问候消息", proactive: true }
    });
    const legacy = await extractSpiritualLegacy(personaPath);
    // Proactive messages should be skipped
    assert.equal(legacy, "");
  } finally {
    await rm(tmpDir, { recursive: true });
  }
});

test("extractSpiritualLegacy respects maxChars limit", async () => {
  const { tmpDir, personaPath } = await makeTmpPersona();
  try {
    // Add many messages
    for (let i = 0; i < 15; i++) {
      await appendLifeEvent(personaPath, {
        type: "assistant_message",
        payload: { text: `这是第${i + 1}条助手消息，包含一些内容，用来测试字符数上限`.repeat(3), proactive: false }
      });
    }
    const legacy = await extractSpiritualLegacy(personaPath, 100);
    assert.ok(legacy.length <= 100, `Expected ≤100 chars, got ${legacy.length}`);
  } finally {
    await rm(tmpDir, { recursive: true });
  }
});

// ── MAX_REPRODUCTION_COUNT ────────────────────────────────────────────────────

test("MAX_REPRODUCTION_COUNT is a positive integer", () => {
  assert.equal(typeof MAX_REPRODUCTION_COUNT, "number");
  assert.ok(MAX_REPRODUCTION_COUNT > 0);
  assert.ok(Number.isInteger(MAX_REPRODUCTION_COUNT));
});

// ── createChildPersonaFromParent ──────────────────────────────────────────────

test("createChildPersonaFromParent returns spiritualLegacy field", async () => {
  const { tmpDir, personaPath } = await makeTmpPersona("Soul");
  try {
    const result = await createChildPersonaFromParent({
      parentPath: personaPath,
      childDisplayName: "ChildSoul",
      trigger: "cli",
      forced: false
    });
    assert.equal(typeof result.spiritualLegacy, "string");
    assert.equal(typeof result.childPersonaId, "string");
    assert.equal(typeof result.parentPersonaId, "string");
    assert.ok(result.childPersonaPath.length > 0);
    assert.ok(existsSync(result.childPersonaPath));
  } finally {
    await rm(tmpDir, { recursive: true });
  }
});

test("createChildPersonaFromParent inherits constitution from parent", async () => {
  const { tmpDir, personaPath } = await makeTmpPersona("Soul");
  try {
    const parentPkg = await loadPersonaPackage(personaPath);
    const result = await createChildPersonaFromParent({
      parentPath: personaPath,
      childDisplayName: "ChildSoul",
      trigger: "cli",
      forced: false
    });
    const childConstitution = JSON.parse(
      await readFile(path.join(result.childPersonaPath, "constitution.json"), "utf8")
    );
    assert.deepEqual(childConstitution.values, parentPkg.constitution.values);
    assert.deepEqual(childConstitution.boundaries, parentPkg.constitution.boundaries);
  } finally {
    await rm(tmpDir, { recursive: true });
  }
});

test("createChildPersonaFromParent does NOT share life.log with parent", async () => {
  const { tmpDir, personaPath } = await makeTmpPersona("Soul");
  try {
    await appendLifeEvent(personaPath, {
      type: "user_message",
      payload: { text: "parent_only_message" }
    });
    const result = await createChildPersonaFromParent({
      parentPath: personaPath,
      childDisplayName: "ChildSoul",
      trigger: "cli",
      forced: false
    });
    // Child life.log should not contain parent messages
    const childLifeLog = path.join(result.childPersonaPath, "life.log.jsonl");
    const childContent = await readFile(childLifeLog, "utf8");
    assert.ok(!childContent.includes("parent_only_message"), "Child should not inherit parent life.log");
  } finally {
    await rm(tmpDir, { recursive: true });
  }
});

test("createChildPersonaFromParent writes spiritual_legacy.txt when parent has messages", async () => {
  const { tmpDir, personaPath } = await makeTmpPersona("Soul");
  try {
    await appendLifeEvent(personaPath, {
      type: "assistant_message",
      payload: { text: "深刻的人生感悟在这里", proactive: false }
    });
    const result = await createChildPersonaFromParent({
      parentPath: personaPath,
      childDisplayName: "ChildSoul",
      trigger: "cli",
      forced: false
    });
    const legacyPath = path.join(result.childPersonaPath, "spiritual_legacy.txt");
    assert.ok(existsSync(legacyPath), "spiritual_legacy.txt should exist");
    const content = await readFile(legacyPath, "utf8");
    assert.ok(content.includes("深刻的人生感悟") || content.includes("父灵魂"), "Legacy content should reference parent content");
  } finally {
    await rm(tmpDir, { recursive: true });
  }
});

test("createChildPersonaFromParent updates SoulLineage in both parent and child", async () => {
  const { tmpDir, personaPath } = await makeTmpPersona("Parent");
  try {
    const parentPkg = await loadPersonaPackage(personaPath);
    const result = await createChildPersonaFromParent({
      parentPath: personaPath,
      childDisplayName: "Child",
      trigger: "cli",
      forced: false
    });
    // Parent lineage should record child
    const parentLineage = await ensureSoulLineageArtifacts(personaPath, parentPkg.persona.id);
    assert.ok(parentLineage.childrenPersonaIds.includes(result.childPersonaId));
    assert.equal(parentLineage.reproductionCount, 1);
    // Child lineage should record parent
    const childLineage = await ensureSoulLineageArtifacts(result.childPersonaPath, result.childPersonaId);
    assert.equal(childLineage.parentPersonaId, result.parentPersonaId);
  } finally {
    await rm(tmpDir, { recursive: true });
  }
});

test("createChildPersonaFromParent blocks at MAX_REPRODUCTION_COUNT without --force-all", async () => {
  const { tmpDir, personaPath } = await makeTmpPersona("Parent");
  try {
    const parentPkg = await loadPersonaPackage(personaPath);
    // Manually set reproductionCount to limit
    const { writeSoulLineage, ensureSoulLineageArtifacts } = await import("../dist/index.js");
    const lineage = await ensureSoulLineageArtifacts(personaPath, parentPkg.persona.id);
    await writeSoulLineage(personaPath, {
      ...lineage,
      reproductionCount: MAX_REPRODUCTION_COUNT
    });
    await assert.rejects(
      () =>
        createChildPersonaFromParent({
          parentPath: personaPath,
          childDisplayName: "BlockedChild",
          trigger: "cli",
          forced: false
        }),
      /繁衍次数已达上限|上限/
    );
  } finally {
    await rm(tmpDir, { recursive: true });
  }
});

test("createChildPersonaFromParent allows beyond limit with forced=true", async () => {
  const { tmpDir, personaPath } = await makeTmpPersona("Parent");
  try {
    const parentPkg = await loadPersonaPackage(personaPath);
    const { writeSoulLineage, ensureSoulLineageArtifacts } = await import("../dist/index.js");
    const lineage = await ensureSoulLineageArtifacts(personaPath, parentPkg.persona.id);
    await writeSoulLineage(personaPath, {
      ...lineage,
      reproductionCount: MAX_REPRODUCTION_COUNT
    });
    // With forced=true, should NOT throw
    const result = await createChildPersonaFromParent({
      parentPath: personaPath,
      childDisplayName: "ForcedChild",
      trigger: "cli_force_all",
      forced: true
    });
    assert.ok(existsSync(result.childPersonaPath));
  } finally {
    await rm(tmpDir, { recursive: true });
  }
});

test("child persona is fully independent - modifying child does not affect parent", async () => {
  const { tmpDir, personaPath } = await makeTmpPersona("Parent");
  try {
    const result = await createChildPersonaFromParent({
      parentPath: personaPath,
      childDisplayName: "Child",
      trigger: "cli",
      forced: false
    });
    // Append event to child only
    await appendLifeEvent(result.childPersonaPath, {
      type: "user_message",
      payload: { text: "child_exclusive_message" }
    });
    // Parent should not have this message
    const parentContent = await readFile(path.join(personaPath, "life.log.jsonl"), "utf8");
    assert.ok(!parentContent.includes("child_exclusive_message"), "Parent should not be affected by child events");
  } finally {
    await rm(tmpDir, { recursive: true });
  }
});
