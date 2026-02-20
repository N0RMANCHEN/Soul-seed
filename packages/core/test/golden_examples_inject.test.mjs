import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  initPersonaPackage,
  addGoldenExample,
  loadAndCompileGoldenExamples,
  compileGoldenExamplesBlock,
  compileContext,
  decide
} from "../dist/index.js";

async function makePersona(suffix = "") {
  const dir = await mkdtemp(path.join(tmpdir(), `soulseed-gei${suffix}-`));
  await initPersonaPackage(dir, { persona: { displayName: "InjectQA" } });
  return dir;
}

const basePkg = {
  persona: { displayName: "InjectQA" },
  constitution: { mission: "助人", values: ["诚实"], boundaries: ["不伤害"] },
  userProfile: { preferredName: "", preferredLanguage: "zh-CN" },
  pinned: { memories: [] }
};

// ── loadAndCompileGoldenExamples ──────────────────────────────────────────────

test("loadAndCompileGoldenExamples：无示例时返回空字符串", async () => {
  const dir = await makePersona("1");
  const block = await loadAndCompileGoldenExamples(dir);
  assert.equal(block, "");
  await rm(dir, { recursive: true, force: true });
});

test("loadAndCompileGoldenExamples：添加示例后返回非空 block", async () => {
  const dir = await makePersona("2");
  await addGoldenExample(dir, "什么是善良？", "善良是关心他人。", { label: "test-good" });
  const block = await loadAndCompileGoldenExamples(dir);
  assert.ok(block.length > 0, "block 应为非空");
  assert.ok(block.includes("什么是善良"), "应包含用户内容");
  assert.ok(block.includes("善良是关心他人"), "应包含助手内容");
  assert.ok(block.includes("Few-shot"), "应包含 Few-shot 标头");
  await rm(dir, { recursive: true, force: true });
});

test("loadAndCompileGoldenExamples：已过期示例不出现在 block 中", async () => {
  const dir = await makePersona("3");
  await addGoldenExample(dir, "过期问题", "过期回答", {
    expiresAt: "2000-01-01T00:00:00.000Z"
  });
  const block = await loadAndCompileGoldenExamples(dir);
  assert.equal(block, "", "过期示例不应出现");
  await rm(dir, { recursive: true, force: true });
});

test("loadAndCompileGoldenExamples：混合有效/过期示例，只保留有效部分", async () => {
  const dir = await makePersona("4");
  await addGoldenExample(dir, "有效问题", "有效回答", { expiresAt: null });
  await addGoldenExample(dir, "过期问题", "过期回答", {
    expiresAt: "2000-01-01T00:00:00.000Z"
  });
  const block = await loadAndCompileGoldenExamples(dir);
  assert.ok(block.includes("有效回答"), "应包含有效示例");
  assert.ok(!block.includes("过期回答"), "不应包含过期示例");
  await rm(dir, { recursive: true, force: true });
});

// ── compileContext + alwaysInjectBlock 集成 ───────────────────────────────────

test("compileContext：alwaysInjectBlock 中的 few-shot 内容出现在系统提示词中", () => {
  const trace = decide(basePkg, "你好", "test-model");
  const fewShotBlock = compileGoldenExamplesBlock([
    {
      id: "abc123",
      version: 1,
      addedAt: "2026-01-01T00:00:00Z",
      addedBy: "user",
      label: "greeting",
      userContent: "今天心情怎么样",
      assistantContent: "还不错，谢谢关心！",
      expiresAt: null
    }
  ]);
  assert.ok(fewShotBlock.length > 0, "fewShotBlock 应非空");

  const messages = compileContext(basePkg, "你好", trace, {
    alwaysInjectBlock: fewShotBlock
  });

  const systemMsg = messages.find(m => m.role === "system");
  assert.ok(systemMsg, "应有 system 消息");
  assert.ok(
    systemMsg.content.includes("今天心情怎么样"),
    "few-shot 用户内容应出现在 system prompt 中"
  );
  assert.ok(
    systemMsg.content.includes("还不错，谢谢关心"),
    "few-shot 助手内容应出现在 system prompt 中"
  );
  assert.ok(
    systemMsg.content.includes("Few-shot"),
    "Few-shot 标头应出现在 system prompt 中"
  );
});

test("compileContext：无 few-shot 时 system prompt 不含 Few-shot 标头", () => {
  const trace = decide(basePkg, "你好", "test-model");
  const messages = compileContext(basePkg, "你好", trace);
  const systemMsg = messages.find(m => m.role === "system");
  assert.ok(systemMsg, "应有 system 消息");
  assert.ok(!systemMsg.content.includes("Few-shot"), "无示例时不应有 Few-shot 标头");
});

// ── 完整端到端：loadAndCompile → compileContext ───────────────────────────────

test("端到端：加载 golden examples 并注入 compileContext", async () => {
  const dir = await makePersona("5");
  await addGoldenExample(dir, "你最喜欢的季节？", "我喜欢秋天，天高云淡。", {
    label: "season"
  });

  const fewShotBlock = await loadAndCompileGoldenExamples(dir);
  assert.ok(fewShotBlock.length > 0);

  const trace = decide(basePkg, "天气怎么样", "test-model");
  const messages = compileContext(basePkg, "天气怎么样", trace, {
    alwaysInjectBlock: fewShotBlock
  });

  const systemMsg = messages.find(m => m.role === "system");
  assert.ok(systemMsg.content.includes("秋天"), "golden example 内容应注入到 system prompt");

  await rm(dir, { recursive: true, force: true });
});
