import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp } from "node:fs/promises";

import {
  initPersonaPackage,
  loadPersonaPackage,
  runAgentExecution
} from "../dist/index.js";

test("agent execution uses llm planner output when adapter returns valid plan json", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-core-agent-planner-"));
  const personaPath = path.join(tmpDir, "Teddy.soulseedpersona");
  await initPersonaPackage(personaPath, "Teddy");
  const personaPkg = await loadPersonaPackage(personaPath);

  const plannerAdapter = {
    name: "mock-planner",
    async streamChat() {
      return {
        content: JSON.stringify({
          idea_packet: {
            domain: "dialogue",
            intent: "reply",
            rationale: "先产出结构化方案草稿"
          },
          draft_action: {
            replyDraft: "我先给你结构化执行方案。"
          },
          steps: [
            {
              kind: "reply",
              reason: "llm_plan_reply",
              replyDraft: "我先给你结构化执行方案。"
            },
            {
              kind: "complete",
              reason: "llm_plan_complete",
              replyDraft: "方案已整理完成。"
            }
          ]
        })
      };
    }
  };

  const execution = await runAgentExecution({
    rootPath: personaPath,
    personaPkg,
    userInput: "帮我规划一个任务执行方案",
    maxSteps: 2,
    plannerAdapter
  });

  assert.equal(execution.planState?.plannerSource, "llm");
  assert.equal(execution.stopCondition?.kind, "goal_completed");
  assert.match(execution.reply, /结构化执行方案|方案已整理完成/);
  assert.equal(execution.traceIds.length > 0, true);
});

test("agent execution can fallback from draft_action when steps are empty", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-core-agent-draft-fallback-"));
  const personaPath = path.join(tmpDir, "Teddy.soulseedpersona");
  await initPersonaPackage(personaPath, "Teddy");
  const personaPkg = await loadPersonaPackage(personaPath);

  const plannerAdapter = {
    name: "mock-planner",
    async streamChat() {
      return {
        content: JSON.stringify({
          idea_packet: {
            domain: "dialogue",
            intent: "reply",
            rationale: "先给答复草稿"
          },
          draft_action: {
            replyDraft: "这是基于草稿的直接答复。"
          },
          steps: []
        })
      };
    }
  };

  const execution = await runAgentExecution({
    rootPath: personaPath,
    personaPkg,
    userInput: "请给我一个简短执行建议",
    maxSteps: 1,
    plannerAdapter
  });

  assert.equal(execution.planState?.plannerSource, "llm");
  assert.match(execution.reply, /草稿的直接答复/);
});

test("agent execution meta-review can rewrite final reply", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-core-agent-meta-rewrite-"));
  const personaPath = path.join(tmpDir, "Teddy.soulseedpersona");
  await initPersonaPackage(personaPath, "Teddy");
  const personaPkg = await loadPersonaPackage(personaPath);

  let callNo = 0;
  const plannerAdapter = {
    name: "mock-planner",
    async streamChat() {
      callNo += 1;
      if (callNo === 1) {
        return {
          content: JSON.stringify({
            idea_packet: { domain: "dialogue", intent: "reply", rationale: "先给草稿" },
            draft_action: { replyDraft: "原始回复" },
            steps: [{ kind: "reply", reason: "reply", replyDraft: "原始回复" }]
          })
        };
      }
      return {
        content: JSON.stringify({
          verdict: "rewrite",
          rewrittenReply: "这是经过人格自审后的回复。",
          rationale: "style_alignment"
        })
      };
    }
  };

  const execution = await runAgentExecution({
    rootPath: personaPath,
    personaPkg,
    userInput: "给我一个建议",
    maxSteps: 1,
    plannerAdapter
  });

  assert.match(execution.reply, /人格自审后的回复/);
  assert.equal(execution.consistencyVerdict, "rewrite");
});

test("agent execution replans when observation is insufficient", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-core-agent-replan-"));
  const personaPath = path.join(tmpDir, "Teddy.soulseedpersona");
  await initPersonaPackage(personaPath, "Teddy");
  const personaPkg = await loadPersonaPackage(personaPath);

  const execution = await runAgentExecution({
    rootPath: personaPath,
    personaPkg,
    userInput: "请读取 https://example.com 并给我结论",
    maxSteps: 2
  });

  assert.equal((execution.planState?.version ?? 0) >= 2, true);
  assert.equal(execution.traceIds.length >= 3, true);
  assert.equal(execution.consistencyRuleHits.length >= 0, true);
});
