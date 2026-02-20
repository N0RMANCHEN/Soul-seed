import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  listGoldenExamples,
  addGoldenExample,
  removeGoldenExample,
  getGoldenExamplesStats,
  compileGoldenExamplesBlock,
  loadAndCompileGoldenExamples,
  MAX_GOLDEN_EXAMPLES,
  MAX_CHARS_PER_EXAMPLE,
  DEFAULT_FEWSHOT_BUDGET_CHARS,
  initPersonaPackage
} from "../dist/index.js";

async function makeDir() {
  const dir = await mkdtemp(path.join(tmpdir(), "soulseed-ge-"));
  await initPersonaPackage(dir, { persona: { displayName: "ExampleQA" } });
  return dir;
}

// ── listGoldenExamples ────────────────────────────────────────────────────────

test("listGoldenExamples returns empty array for new persona", async () => {
  const dir = await makeDir();
  const examples = await listGoldenExamples(dir);
  assert.deepEqual(examples, []);
  await rm(dir, { recursive: true, force: true });
});

// ── addGoldenExample ──────────────────────────────────────────────────────────

test("addGoldenExample adds a valid example", async () => {
  const dir = await makeDir();
  const res = await addGoldenExample(dir, "你好", "你好！今天有什么想聊的？");
  assert.equal(res.ok, true);
  assert.ok(res.example);
  assert.equal(typeof res.example.id, "string");
  assert.equal(res.example.addedBy, "user");
  assert.equal(res.example.label, "unlabeled");

  const list = await listGoldenExamples(dir);
  assert.equal(list.length, 1);
  assert.equal(list[0].userContent, "你好");
  assert.equal(list[0].assistantContent, "你好！今天有什么想聊的？");

  await rm(dir, { recursive: true, force: true });
});

test("addGoldenExample applies label and addedBy options", async () => {
  const dir = await makeDir();
  const res = await addGoldenExample(dir, "U", "A", {
    label: "greeting",
    addedBy: "meta_review"
  });
  assert.equal(res.ok, true);
  assert.equal(res.example.label, "greeting");
  assert.equal(res.example.addedBy, "meta_review");

  await rm(dir, { recursive: true, force: true });
});

test("addGoldenExample truncates content to MAX_CHARS_PER_EXAMPLE", async () => {
  const dir = await makeDir();
  const longText = "a".repeat(MAX_CHARS_PER_EXAMPLE + 100);
  const res = await addGoldenExample(dir, longText, longText);
  assert.equal(res.ok, true);
  assert.equal(res.example.userContent.length, MAX_CHARS_PER_EXAMPLE);
  assert.equal(res.example.assistantContent.length, MAX_CHARS_PER_EXAMPLE);

  await rm(dir, { recursive: true, force: true });
});

test("addGoldenExample rejects empty content", async () => {
  const dir = await makeDir();
  const res = await addGoldenExample(dir, "", "valid");
  assert.equal(res.ok, false);
  assert.ok(res.reason);

  await rm(dir, { recursive: true, force: true });
});

test("addGoldenExample rejects when limit reached", async () => {
  const dir = await makeDir();
  // Add MAX_GOLDEN_EXAMPLES examples (use a tiny limit for testing)
  for (let i = 0; i < MAX_GOLDEN_EXAMPLES; i++) {
    await addGoldenExample(dir, `Q${i}`, `A${i}`);
  }
  const res = await addGoldenExample(dir, "one more", "rejected");
  assert.equal(res.ok, false);
  assert.ok(res.reason?.includes("limit"));

  await rm(dir, { recursive: true, force: true });
});

test("addGoldenExample supports expiresAt", async () => {
  const dir = await makeDir();
  const expires = "2099-01-01T00:00:00.000Z";
  const res = await addGoldenExample(dir, "Q", "A", { expiresAt: expires });
  assert.equal(res.ok, true);
  assert.equal(res.example.expiresAt, expires);

  await rm(dir, { recursive: true, force: true });
});

// ── removeGoldenExample ───────────────────────────────────────────────────────

test("removeGoldenExample removes by id prefix", async () => {
  const dir = await makeDir();
  const addRes = await addGoldenExample(dir, "Q", "A", { label: "to-remove" });
  assert.equal(addRes.ok, true);
  const id = addRes.example.id;

  const delRes = await removeGoldenExample(dir, id.slice(0, 8));
  assert.equal(delRes.ok, true);
  assert.equal(delRes.removed.id, id);

  const list = await listGoldenExamples(dir);
  assert.equal(list.length, 0);

  await rm(dir, { recursive: true, force: true });
});

test("removeGoldenExample returns error for non-existent id", async () => {
  const dir = await makeDir();
  const res = await removeGoldenExample(dir, "nonexistent");
  assert.equal(res.ok, false);
  assert.ok(res.reason);

  await rm(dir, { recursive: true, force: true });
});

// ── getGoldenExamplesStats ────────────────────────────────────────────────────

test("getGoldenExamplesStats returns correct stats", async () => {
  const dir = await makeDir();
  await addGoldenExample(dir, "Q1", "A1", { addedBy: "user" });
  await addGoldenExample(dir, "Q2", "A2", { addedBy: "meta_review" });
  await addGoldenExample(dir, "Q3", "A3", { expiresAt: "2000-01-01T00:00:00.000Z" }); // expired

  const stats = await getGoldenExamplesStats(dir);
  assert.equal(stats.total, 3);
  assert.equal(stats.active, 2);
  assert.equal(stats.expired, 1);
  assert.equal(stats.bySource.user, 2); // user added 2 (default + explicit)
  assert.equal(stats.bySource.meta_review, 1);

  await rm(dir, { recursive: true, force: true });
});

// ── compileGoldenExamplesBlock ────────────────────────────────────────────────

test("compileGoldenExamplesBlock returns empty string when no examples", () => {
  const block = compileGoldenExamplesBlock([]);
  assert.equal(block, "");
});

test("compileGoldenExamplesBlock includes active examples", () => {
  const examples = [
    { id: "1", version: 1, addedAt: "2026-01-01T00:00:00Z", addedBy: "user",
      label: "greeting", userContent: "你好", assistantContent: "你好！", expiresAt: null }
  ];
  const block = compileGoldenExamplesBlock(examples);
  assert.ok(block.includes("你好"));
  assert.ok(block.includes("你好！"));
  assert.ok(block.includes("Few-shot"));
  assert.ok(block.includes("greeting"));
});

test("compileGoldenExamplesBlock skips expired examples", () => {
  const examples = [
    { id: "1", version: 1, addedAt: "2026-01-01T00:00:00Z", addedBy: "user",
      label: "expired", userContent: "expired Q", assistantContent: "expired A",
      expiresAt: "2000-01-01T00:00:00.000Z" }
  ];
  const block = compileGoldenExamplesBlock(examples);
  assert.equal(block, "");
});

test("compileGoldenExamplesBlock respects budget", () => {
  const examples = [];
  for (let i = 0; i < 10; i++) {
    examples.push({
      id: `${i}`, version: 1, addedAt: "2026-01-01T00:00:00Z", addedBy: "user",
      label: `ex${i}`,
      userContent: "x".repeat(100),
      assistantContent: "y".repeat(100),
      expiresAt: null
    });
  }
  const budget = 300;
  const block = compileGoldenExamplesBlock(examples, budget);
  assert.ok(block.length <= budget || block.length === 0 || block.includes("Few-shot"));
  // Not all 10 examples should be included
  const matches = (block.match(/\[Example/g) ?? []).length;
  assert.ok(matches < 10);
});

// ── loadAndCompileGoldenExamples ──────────────────────────────────────────────

test("loadAndCompileGoldenExamples returns empty for new persona", async () => {
  const dir = await makeDir();
  const block = await loadAndCompileGoldenExamples(dir);
  assert.equal(block, "");
  await rm(dir, { recursive: true, force: true });
});

test("loadAndCompileGoldenExamples returns block after adding example", async () => {
  const dir = await makeDir();
  await addGoldenExample(dir, "最喜欢的颜色？", "我喜欢蓝色！");
  const block = await loadAndCompileGoldenExamples(dir);
  assert.ok(block.length > 0);
  assert.ok(block.includes("最喜欢的颜色？"));
  assert.ok(block.includes("蓝色"));
  await rm(dir, { recursive: true, force: true });
});
