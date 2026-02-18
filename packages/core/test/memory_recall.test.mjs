import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { mkdtemp } from "node:fs/promises";

import { appendLifeEvent, initPersonaPackage, recallMemoriesWithTrace } from "../dist/index.js";

function sqlite(dbPath, sql) {
  return execFileSync("sqlite3", [dbPath, sql], { encoding: "utf8" }).trim();
}

test("recall pipeline writes trace with scores/reasons and enforces inject budgets", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-memory-recall-"));
  const personaPath = path.join(tmpDir, "Roxy.soulseedpersona");
  const dbPath = path.join(personaPath, "memory.db");

  await initPersonaPackage(personaPath, "Roxy");

  for (let i = 0; i < 8; i += 1) {
    await appendLifeEvent(personaPath, {
      type: "user_message",
      payload: {
        text: `记住我的偏好 ${i}，我喜欢清晰结构化回答。`,
        memoryMeta: {
          tier: "highlight",
          storageCost: 3,
          retrievalCost: 2,
          source: "chat",
          salienceScore: 0.95 - i * 0.05,
          state: "hot"
        }
      }
    });
  }

  const result = await recallMemoriesWithTrace(personaPath, "你还记得我的偏好吗", {
    budget: {
      injectMax: 2,
      injectCharMax: 140
    }
  });

  assert.equal(result.memories.length <= 2, true);
  assert.equal(result.memories.join("").length <= 140, true);

  const selectedRaw = sqlite(
    dbPath,
    `SELECT selected_ids_json FROM recall_traces WHERE id='${result.traceId}';`
  );
  const scoresRaw = sqlite(
    dbPath,
    `SELECT scores_json FROM recall_traces WHERE id='${result.traceId}';`
  );
  const budgetRaw = sqlite(
    dbPath,
    `SELECT budget_json FROM recall_traces WHERE id='${result.traceId}';`
  );
  const selected = JSON.parse(selectedRaw);
  const scores = JSON.parse(scoresRaw);
  const budget = JSON.parse(budgetRaw);

  assert.equal(Array.isArray(selected), true);
  assert.equal(Array.isArray(result.selectedIds), true);
  assert.equal(Array.isArray(scores), true);
  assert.equal(Array.isArray(budget.intents), true);
  assert.equal(typeof scores[0]?.score, "number");
  assert.equal(scores.some((item) => item.reason === "inject_item_budget"), true);
});

test("recall pipeline never injects soft-deleted memories", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-memory-recall-deleted-"));
  const personaPath = path.join(tmpDir, "Roxy.soulseedpersona");
  const dbPath = path.join(personaPath, "memory.db");

  await initPersonaPackage(personaPath, "Roxy");
  await appendLifeEvent(personaPath, {
    type: "user_message",
    payload: {
      text: "删除候选：我最喜欢写科幻小说。",
      memoryMeta: {
        tier: "highlight",
        storageCost: 3,
        retrievalCost: 2,
        source: "chat",
        salienceScore: 0.99,
        state: "hot"
      }
    }
  });
  await appendLifeEvent(personaPath, {
    type: "user_message",
    payload: {
      text: "保留候选：我周末会去跑步。",
      memoryMeta: {
        tier: "highlight",
        storageCost: 3,
        retrievalCost: 2,
        source: "chat",
        salienceScore: 0.95,
        state: "hot"
      }
    }
  });

  sqlite(
    dbPath,
    "UPDATE memories SET deleted_at='2026-02-17T00:00:00.000Z' WHERE content LIKE '删除候选%';"
  );

  const result = await recallMemoriesWithTrace(personaPath, "你还记得我喜欢什么吗");
  assert.equal(result.memories.some((item) => item.includes("删除候选")), false);
});

test("recall excludes excluded_from_recall and strengthens selected memories", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-memory-recall-strengthen-"));
  const personaPath = path.join(tmpDir, "Roxy.soulseedpersona");
  const dbPath = path.join(personaPath, "memory.db");

  await initPersonaPackage(personaPath, "Roxy");
  await appendLifeEvent(personaPath, {
    type: "user_message",
    payload: {
      text: "可召回：我喜欢晨跑。",
      memoryMeta: {
        tier: "highlight",
        storageCost: 3,
        retrievalCost: 2,
        source: "chat",
        salienceScore: 0.9,
        state: "hot",
        activationCount: 2,
        credibilityScore: 1
      }
    }
  });
  await appendLifeEvent(personaPath, {
    type: "user_message",
    payload: {
      text: "禁召回：这条不该被回忆。",
      memoryMeta: {
        tier: "highlight",
        storageCost: 3,
        retrievalCost: 2,
        source: "chat",
        salienceScore: 0.98,
        state: "hot",
        excludedFromRecall: true
      }
    }
  });

  const before = sqlite(
    dbPath,
    "SELECT id || '|' || activation_count || '|' || reconsolidation_count FROM memories WHERE content LIKE '可召回：%' LIMIT 1;"
  ).split("|");
  const targetId = before[0];
  const activationBefore = Number(before[1]);
  const reconsolidationBefore = Number(before[2]);

  const result = await recallMemoriesWithTrace(personaPath, "你还记得我喜欢什么吗");
  assert.equal(result.memories.some((item) => item.includes("禁召回")), false);
  assert.equal(result.selectedIds.includes(targetId), true);

  const after = sqlite(
    dbPath,
    `SELECT activation_count || '|' || reconsolidation_count FROM memories WHERE id='${targetId}';`
  ).split("|");
  const activationAfter = Number(after[0]);
  const reconsolidationAfter = Number(after[1]);
  assert.equal(activationAfter > activationBefore, true);
  assert.equal(reconsolidationAfter > reconsolidationBefore, true);
});

test("recall can select keyword-matching memory even when low salience", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-memory-recall-keyword-route-"));
  const personaPath = path.join(tmpDir, "Roxy.soulseedpersona");
  const dbPath = path.join(personaPath, "memory.db");

  await initPersonaPackage(personaPath, "Roxy");
  for (let i = 0; i < 80; i += 1) {
    await appendLifeEvent(personaPath, {
      type: "user_message",
      payload: {
        text: `噪声记忆 ${i}：今天的通用对话内容。`,
        memoryMeta: {
          tier: "highlight",
          storageCost: 3,
          retrievalCost: 2,
          source: "chat",
          salienceScore: 0.99,
          state: "hot"
        }
      }
    });
  }
  await appendLifeEvent(personaPath, {
    type: "user_message",
    payload: {
      text: "奥入濑溪流那篇文章的关键词：若溪。",
      memoryMeta: {
        tier: "pattern",
        storageCost: 1,
        retrievalCost: 1,
        source: "chat",
        salienceScore: 0.2,
        state: "cold"
      }
    }
  });

  const result = await recallMemoriesWithTrace(personaPath, "奥入濑溪流", {
    budget: {
      candidateMax: 30,
      rerankMax: 12,
      injectMax: 4
    }
  });
  const scoresRaw = sqlite(
    dbPath,
    `SELECT scores_json FROM recall_traces WHERE id='${result.traceId}';`
  );
  const scores = JSON.parse(scoresRaw);
  const keywordRoutedCandidate = scores.some(
    (item) =>
      typeof item.keywordHits === "number" &&
      item.keywordHits > 0 &&
      (item.candidateSource === "keyword" || item.candidateSource === "both")
  );
  assert.equal(keywordRoutedCandidate, true);
});

test("recall trace includes candidate source and keyword hit metadata", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-memory-recall-trace-meta-"));
  const personaPath = path.join(tmpDir, "Roxy.soulseedpersona");
  const dbPath = path.join(personaPath, "memory.db");

  await initPersonaPackage(personaPath, "Roxy");
  await appendLifeEvent(personaPath, {
    type: "user_message",
    payload: {
      text: "若溪来自奥入濑溪流这篇文章。",
      memoryMeta: {
        tier: "highlight",
        storageCost: 3,
        retrievalCost: 2,
        source: "chat",
        salienceScore: 0.35,
        state: "cold"
      }
    }
  });

  const result = await recallMemoriesWithTrace(personaPath, "奥入濑溪流你还记得吗");
  const scoresRaw = sqlite(
    dbPath,
    `SELECT scores_json FROM recall_traces WHERE id='${result.traceId}';`
  );
  const scores = JSON.parse(scoresRaw);
  const hit = scores.find((item) => typeof item.keywordHits === "number" && item.keywordHits > 0);
  assert.notEqual(hit, undefined);
  assert.equal(["salience", "keyword", "both"].includes(hit.candidateSource), true);
  assert.equal(typeof hit.scoreBreakdown, "object");
});
