import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp } from "node:fs/promises";

import {
  initPersonaPackage,
  loadAutobiography,
  appendAutobiographyChapter,
  generateArcSummary,
  updateSelfUnderstanding
} from "../dist/index.js";

test("P5-0: generateArcSummary returns placeholder for empty autobiography", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-arc-empty-"));
  const personaPath = path.join(tmpDir, "TestArcEmpty.soulseedpersona");
  await initPersonaPackage(personaPath, "TestArcEmpty");

  const auto = await loadAutobiography(personaPath);
  const summary = generateArcSummary(auto);
  assert.ok(summary.includes("尚无"), `expected placeholder, got: ${summary}`);
});

test("P5-0: generateArcSummary shows timeline with chapters", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-arc-chapters-"));
  const personaPath = path.join(tmpDir, "TestArcChapters.soulseedpersona");
  await initPersonaPackage(personaPath, "TestArcChapters");

  await appendAutobiographyChapter(personaPath, {
    title: "相遇", summary: "最初相识的时光。", period: { from: "2025-01-01", to: "2025-03-01" },
    keyEventHashes: [], emotionalTone: "curious", growthVector: "从陌生到熟悉"
  });
  await appendAutobiographyChapter(personaPath, {
    title: "成长", summary: "慢慢了解彼此。", period: { from: "2025-03-01", to: "2025-06-01" },
    keyEventHashes: [], emotionalTone: "warm", growthVector: "逐渐建立信任"
  });

  const auto = await loadAutobiography(personaPath);
  const summary = generateArcSummary(auto);

  assert.ok(summary.includes("2025-01-01"), "should show start date");
  assert.ok(summary.includes("2025-06-01"), "should show end date");
  assert.ok(summary.includes("从陌生到熟悉"), "should show growthVector");
  assert.ok(summary.includes("相遇"), "should show chapter title");
});

test("P5-0: generateArcSummary includes selfUnderstanding when present", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-arc-self-"));
  const personaPath = path.join(tmpDir, "TestArcSelf.soulseedpersona");
  await initPersonaPackage(personaPath, "TestArcSelf");

  await appendAutobiographyChapter(personaPath, {
    title: "第一章", summary: "起始。", period: { from: "2025-01-01", to: "2025-03-01" },
    keyEventHashes: [], emotionalTone: "neutral"
  });
  await updateSelfUnderstanding(personaPath, "我是一个在不断成长的存在。");

  const auto = await loadAutobiography(personaPath);
  const summary = generateArcSummary(auto);
  assert.ok(summary.includes("我是一个在不断成长的存在"), "should include selfUnderstanding");
});

test("P5-0: chapter growthVector persisted correctly", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-arc-gv-"));
  const personaPath = path.join(tmpDir, "TestGV.soulseedpersona");
  await initPersonaPackage(personaPath, "TestGV");

  const result = await appendAutobiographyChapter(personaPath, {
    title: "成长", summary: "变化。", period: { from: "2025-01-01", to: "2025-06-01" },
    keyEventHashes: [], emotionalTone: "warm", growthVector: "从顺从到自主"
  });
  assert.equal(result.chapters[0].growthVector, "从顺从到自主");
});
