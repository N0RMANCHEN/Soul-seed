import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  exportFinetuneDataset,
  initPersonaPackage,
  appendLifeEvent
} from "../dist/index.js";

async function makePersona(suffix = "") {
  const dir = await mkdtemp(path.join(tmpdir(), `soulseed-ft${suffix}-`));
  await initPersonaPackage(dir, { persona: { displayName: "FinetuneQA" } });
  return dir;
}

async function injectTurn(dir, userText, assistantText, opts = {}) {
  await appendLifeEvent(dir, { type: "user_message", payload: { text: userText } });
  await appendLifeEvent(dir, {
    type: "assistant_message",
    payload: {
      text: assistantText,
      trace: {
        version: "1.0",
        refuse: opts.refuse ?? false,
        riskLevel: opts.riskLevel ?? "low",
        consistencyVerdict: opts.verdict ?? "allow",
        model: "test-model"
      },
      ...(opts.proactive ? { proactive: true } : {}),
      ...(opts.contaminated
        ? { memoryMeta: { contaminationFlags: ["test-flag"] } }
        : {})
    }
  });
}

// ── basic export ──────────────────────────────────────────────────────────────

test("exportFinetuneDataset exports valid turns", async () => {
  const dir = await makePersona("1");
  const outPath = path.join(dir, "out.jsonl");
  await injectTurn(dir, "你好", "你好！");
  await injectTurn(dir, "你叫什么名字？", "我是 FinetuneQA。");

  const result = await exportFinetuneDataset(dir, outPath);
  assert.equal(result.exportedTurns, 2);
  assert.equal(result.skippedBeforeMinTurns, false);

  const lines = (await readFile(outPath, "utf8")).trim().split("\n");
  assert.equal(lines.length, 2);

  const first = JSON.parse(lines[0]);
  assert.ok(Array.isArray(first.messages));
  assert.equal(first.messages[0].role, "system");
  assert.equal(first.messages[1].role, "user");
  assert.equal(first.messages[1].content, "你好");
  assert.equal(first.messages[2].role, "assistant");
  assert.equal(first.messages[2].content, "你好！");
  assert.ok(first.meta.consistencyVerdict === "allow");

  await rm(dir, { recursive: true, force: true });
});

// ── filters ───────────────────────────────────────────────────────────────────

test("exportFinetuneDataset skips refused turns", async () => {
  const dir = await makePersona("2");
  const outPath = path.join(dir, "out.jsonl");
  await injectTurn(dir, "valid", "ok reply");
  await injectTurn(dir, "bad request", "I refuse", { refuse: true });

  const result = await exportFinetuneDataset(dir, outPath);
  assert.equal(result.exportedTurns, 1);
  assert.equal(result.skippedTurns.refused, 1);

  await rm(dir, { recursive: true, force: true });
});

test("exportFinetuneDataset skips high-risk turns", async () => {
  const dir = await makePersona("3");
  const outPath = path.join(dir, "out.jsonl");
  await injectTurn(dir, "valid", "ok");
  await injectTurn(dir, "risky", "risky reply", { riskLevel: "high" });

  const result = await exportFinetuneDataset(dir, outPath);
  assert.equal(result.exportedTurns, 1);
  assert.equal(result.skippedTurns.highRisk, 1);

  await rm(dir, { recursive: true, force: true });
});

test("exportFinetuneDataset skips non-allow consistency verdicts", async () => {
  const dir = await makePersona("4");
  const outPath = path.join(dir, "out.jsonl");
  await injectTurn(dir, "valid", "ok");
  await injectTurn(dir, "rewritten", "rewritten reply", { verdict: "rewrite" });
  await injectTurn(dir, "rejected", "reject reply", { verdict: "reject" });

  const result = await exportFinetuneDataset(dir, outPath);
  assert.equal(result.exportedTurns, 1);
  assert.equal(result.skippedTurns.notAllow, 2);

  await rm(dir, { recursive: true, force: true });
});

test("exportFinetuneDataset skips proactive assistant messages", async () => {
  const dir = await makePersona("5");
  const outPath = path.join(dir, "out.jsonl");
  await injectTurn(dir, "user input", "normal reply");
  await injectTurn(dir, "user input 2", "proactive reply", { proactive: true });

  const result = await exportFinetuneDataset(dir, outPath);
  assert.equal(result.exportedTurns, 1);
  assert.equal(result.skippedTurns.proactive, 1);

  await rm(dir, { recursive: true, force: true });
});

test("exportFinetuneDataset skips contaminated turns", async () => {
  const dir = await makePersona("6");
  const outPath = path.join(dir, "out.jsonl");
  await injectTurn(dir, "clean", "clean reply");
  await injectTurn(dir, "dirty", "contaminated reply", { contaminated: true });

  const result = await exportFinetuneDataset(dir, outPath);
  assert.equal(result.exportedTurns, 1);
  assert.equal(result.skippedTurns.contaminated, 1);

  await rm(dir, { recursive: true, force: true });
});

// ── minTurns gate ─────────────────────────────────────────────────────────────

test("exportFinetuneDataset skips export when below minTurns", async () => {
  const dir = await makePersona("7");
  const outPath = path.join(dir, "out.jsonl");
  await injectTurn(dir, "only one turn", "reply");

  const result = await exportFinetuneDataset(dir, outPath, { minTurns: 5 });
  assert.equal(result.exportedTurns, 0);
  assert.equal(result.skippedBeforeMinTurns, true);

  await rm(dir, { recursive: true, force: true });
});

test("exportFinetuneDataset proceeds when exactly at minTurns", async () => {
  const dir = await makePersona("8");
  const outPath = path.join(dir, "out.jsonl");
  for (let i = 0; i < 3; i++) {
    await injectTurn(dir, `question ${i}`, `answer ${i}`);
  }

  const result = await exportFinetuneDataset(dir, outPath, { minTurns: 3 });
  assert.equal(result.exportedTurns, 3);
  assert.equal(result.skippedBeforeMinTurns, false);

  await rm(dir, { recursive: true, force: true });
});

// ── maxTurns cap ──────────────────────────────────────────────────────────────

test("exportFinetuneDataset caps output at maxTurns", async () => {
  const dir = await makePersona("9");
  const outPath = path.join(dir, "out.jsonl");
  for (let i = 0; i < 10; i++) {
    await injectTurn(dir, `q${i}`, `a${i}`);
  }

  const result = await exportFinetuneDataset(dir, outPath, { maxTurns: 4 });
  assert.equal(result.exportedTurns, 4);
  const lines = (await readFile(outPath, "utf8")).trim().split("\n");
  assert.equal(lines.length, 4);

  await rm(dir, { recursive: true, force: true });
});

// ── system prompt ─────────────────────────────────────────────────────────────

test("exportFinetuneDataset uses custom systemPrompt when provided", async () => {
  const dir = await makePersona("10");
  const outPath = path.join(dir, "out.jsonl");
  await injectTurn(dir, "hi", "hello");

  const result = await exportFinetuneDataset(dir, outPath, { systemPrompt: "CUSTOM SYSTEM" });
  assert.equal(result.exportedTurns, 1);
  const record = JSON.parse((await readFile(outPath, "utf8")).trim());
  assert.equal(record.messages[0].content, "CUSTOM SYSTEM");

  await rm(dir, { recursive: true, force: true });
});

// ── empty persona ─────────────────────────────────────────────────────────────

test("exportFinetuneDataset handles persona with no life events", async () => {
  const dir = await makePersona("11");
  const outPath = path.join(dir, "out.jsonl");

  const result = await exportFinetuneDataset(dir, outPath);
  assert.equal(result.exportedTurns, 0);
  assert.equal(result.totalTurnCandidates, 0);
  assert.equal(result.skippedBeforeMinTurns, false);

  await rm(dir, { recursive: true, force: true });
});

// ── meta fields ───────────────────────────────────────────────────────────────

test("exportFinetuneDataset record meta contains expected fields", async () => {
  const dir = await makePersona("12");
  const outPath = path.join(dir, "out.jsonl");
  await injectTurn(dir, "question", "answer");

  await exportFinetuneDataset(dir, outPath);
  const record = JSON.parse((await readFile(outPath, "utf8")).trim());
  assert.ok(typeof record.meta.userEventHash === "string");
  assert.ok(typeof record.meta.assistantEventHash === "string");
  assert.equal(record.meta.consistencyVerdict, "allow");
  assert.equal(record.meta.riskLevel, "low");

  await rm(dir, { recursive: true, force: true });
});
