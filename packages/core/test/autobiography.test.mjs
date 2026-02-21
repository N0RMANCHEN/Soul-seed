import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp } from "node:fs/promises";

import {
  initPersonaPackage,
  loadAutobiography,
  appendAutobiographyChapter,
  updateSelfUnderstanding,
  isAutobiographyValid,
  createInitialAutobiography
} from "../dist/index.js";

test("P2-2: initPersonaPackage creates autobiography.json", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-auto-init-"));
  const personaPath = path.join(tmpDir, "TestAuto.soulseedpersona");
  await initPersonaPackage(personaPath, "TestAuto");

  const auto = await loadAutobiography(personaPath);
  assert.ok(auto !== null, "autobiography.json should exist after init");
  assert.deepEqual(auto.chapters, []);
  assert.equal(auto.selfUnderstanding, "");
  assert.equal(auto.lastDistilledAt, null);
});

test("P2-2: isAutobiographyValid accepts valid data", () => {
  assert.equal(isAutobiographyValid(createInitialAutobiography()), true);
});

test("P2-2: isAutobiographyValid rejects invalid data", () => {
  assert.equal(isAutobiographyValid({ chapters: "bad", selfUnderstanding: "" }), false);
});

test("P2-2: appendAutobiographyChapter adds chapter and preserves history", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-auto-chapter-"));
  const personaPath = path.join(tmpDir, "TestChapter.soulseedpersona");
  await initPersonaPackage(personaPath, "TestChapter");

  const first = await appendAutobiographyChapter(personaPath, {
    title: "第一章：相遇",
    summary: "这是最初相遇的故事。",
    period: { from: "2025-01-01", to: "2025-03-01" },
    keyEventHashes: [],
    emotionalTone: "curious"
  });
  assert.equal(first.chapters.length, 1);
  assert.equal(first.chapters[0].title, "第一章：相遇");

  const second = await appendAutobiographyChapter(personaPath, {
    title: "第二章：成长",
    summary: "这是成长的故事。",
    period: { from: "2025-03-01", to: "2025-06-01" },
    keyEventHashes: [],
    emotionalTone: "warm"
  });
  assert.equal(second.chapters.length, 2);
  // First chapter preserved
  assert.equal(second.chapters[0].title, "第一章：相遇");
  assert.equal(second.chapters[1].title, "第二章：成长");
});

test("P2-2: updateSelfUnderstanding updates text and timestamp", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-auto-self-"));
  const personaPath = path.join(tmpDir, "TestSelf.soulseedpersona");
  await initPersonaPackage(personaPath, "TestSelf");

  const before = await loadAutobiography(personaPath);
  assert.equal(before.selfUnderstanding, "");

  await updateSelfUnderstanding(personaPath, "我是一个在不断成长的存在，我的记忆构成了我。");
  const after = await loadAutobiography(personaPath);
  assert.equal(after.selfUnderstanding, "我是一个在不断成长的存在，我的记忆构成了我。");
  assert.ok(typeof after.lastDistilledAt === "string", "lastDistilledAt should be set");
});

test("P2-2: chapter summary truncated to 200 chars", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-auto-trunc-"));
  const personaPath = path.join(tmpDir, "TestTrunc.soulseedpersona");
  await initPersonaPackage(personaPath, "TestTrunc");

  const longSummary = "a".repeat(300);
  const result = await appendAutobiographyChapter(personaPath, {
    title: "Long Chapter",
    summary: longSummary,
    period: { from: "2025-01-01", to: "2025-01-02" },
    keyEventHashes: [],
    emotionalTone: "neutral"
  });
  assert.equal(result.chapters[0].summary.length, 200);
});
