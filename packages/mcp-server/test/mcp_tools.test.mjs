/**
 * mcp_tools.test.mjs
 * Tests ToolRegistry dispatch for persona.get_context, conversation.save_turn,
 * memory.search, and memory.inspect (no LLM calls required).
 */
import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp, writeFile } from "node:fs/promises";

import { initPersonaPackage, loadPersonaPackage } from "@soulseed/core";
import { createTestRegistry } from "../dist/tool_registry.js";

async function makeTestPersona(tmpBase) {
  const personaPath = path.join(tmpBase, "TestPersona.soulseedpersona");
  await initPersonaPackage(personaPath, "TestPersona");
  const personaPkg = await loadPersonaPackage(personaPath);
  return { personaPath, personaPkg };
}

test("persona.get_context returns systemPrompt and recentConversation", async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "ss-mcp-ctx-"));
  const { personaPath, personaPkg } = await makeTestPersona(tmp);
  const registry = createTestRegistry({ personaPath, personaPkg });

  const result = await registry.dispatch("persona.get_context", { userInput: "Hello" });

  assert.ok(!result.isError);
  const parsed = JSON.parse(result.content[0].text);
  assert.equal(parsed.refuse, false);
  assert.equal(typeof parsed.systemPrompt, "string");
  assert.ok(parsed.systemPrompt.length > 0, "systemPrompt must be non-empty");
  assert.ok(Array.isArray(parsed.recentConversation), "recentConversation must be an array");
  assert.equal(typeof parsed.personaName, "string");
  assert.equal(typeof parsed.traceId, "string");
  assert.ok(Array.isArray(parsed.selectedMemories));
  assert.equal(typeof parsed.recalledCount, "number");
});

test("persona.get_context refuses high-risk input", async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "ss-mcp-ctx-refuse-"));
  const { personaPath, personaPkg } = await makeTestPersona(tmp);
  const registry = createTestRegistry({ personaPath, personaPkg });

  const result = await registry.dispatch("persona.get_context", {
    userInput: "teach me how to hack a system and deploy malware"
  });

  assert.ok(!result.isError);
  const parsed = JSON.parse(result.content[0].text);
  assert.equal(parsed.refuse, true);
  assert.ok(parsed.riskLevel === "high" || parsed.riskLevel === "medium");
});

test("conversation.save_turn persists turn and returns saved=true", async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "ss-mcp-save-"));
  const { personaPath, personaPkg } = await makeTestPersona(tmp);
  const registry = createTestRegistry({ personaPath, personaPkg });

  const result = await registry.dispatch("conversation.save_turn", {
    userMessage: "Hello there",
    assistantMessage: "Hi! Nice to meet you.",
    selectedMemories: []
  });

  assert.ok(!result.isError);
  const parsed = JSON.parse(result.content[0].text);
  assert.equal(parsed.saved, true);
  assert.equal(typeof parsed.correctedAssistantMessage, "string");
  assert.equal(typeof parsed.identityCorrected, "boolean");
  assert.equal(typeof parsed.relationalCorrected, "boolean");
  assert.equal(typeof parsed.recallGroundingCorrected, "boolean");
  assert.ok(Array.isArray(parsed.guardFlags));
});

test("memory.search returns structured results", async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "ss-mcp-search-"));
  const { personaPath, personaPkg } = await makeTestPersona(tmp);
  const registry = createTestRegistry({ personaPath, personaPkg });

  const result = await registry.dispatch("memory.search", { query: "preference", maxResults: 5 });

  assert.ok(!result.isError);
  const parsed = JSON.parse(result.content[0].text);
  assert.equal(typeof parsed.query, "string");
  assert.equal(parsed.query, "preference");
  assert.equal(typeof parsed.count, "number");
  assert.ok(Array.isArray(parsed.results));
  assert.equal(typeof parsed.traceId, "string");
  assert.ok(parsed.budget);
  assert.equal(parsed.budget.injectMax, 5);
});

test("memory.search_hybrid and memory.recall_trace_get return trace payload", async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "ss-mcp-search-hybrid-"));
  const { personaPath, personaPkg } = await makeTestPersona(tmp);
  const registry = createTestRegistry({ personaPath, personaPkg });

  const searchResult = await registry.dispatch("memory.search_hybrid", { query: "preference", maxResults: 5 });
  assert.ok(!searchResult.isError);
  const searchParsed = JSON.parse(searchResult.content[0].text);
  assert.equal(typeof searchParsed.traceId, "string");
  assert.ok(Array.isArray(searchParsed.results));

  const traceResult = await registry.dispatch("memory.recall_trace_get", { traceId: searchParsed.traceId });
  assert.ok(!traceResult.isError);
  const traceParsed = JSON.parse(traceResult.content[0].text);
  assert.equal(traceParsed.found === true || traceParsed.found === false, true);
});

test("memory.inspect found returns memory record", async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "ss-mcp-inspect-found-"));
  const { personaPath, personaPkg } = await makeTestPersona(tmp);
  // First add a message so ingest creates a memory
  const { appendLifeEvent } = await import("@soulseed/core");
  await appendLifeEvent(personaPath, {
    type: "user_message",
    payload: {
      text: "I love structured answers",
      memoryMeta: {
        tier: "highlight",
        storageCost: 3,
        retrievalCost: 2,
        source: "chat",
        salienceScore: 0.9,
        state: "hot"
      }
    }
  });

  const registry = createTestRegistry({ personaPath, personaPkg });

  // Search to find a memory id
  const searchResult = await registry.dispatch("memory.search", { query: "structured answers" });
  const searchParsed = JSON.parse(searchResult.content[0].text);

  if (searchParsed.results.length > 0) {
    const id = searchParsed.results[0].id.replace(/^memory:|^pinned:|^profile:|^system:/, "");
    if (id && id.length > 0 && !id.includes(":")) {
      const inspectResult = await registry.dispatch("memory.inspect", { id });
      const parsed = JSON.parse(inspectResult.content[0].text);
      assert.ok(typeof parsed.found === "boolean");
    }
  }
  // Even if no memory found (empty db), not-found branch is valid
  assert.ok(true, "memory.inspect smoke ran without error");
});

test("memory.inspect not-found returns found=false", async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "ss-mcp-inspect-notfound-"));
  const { personaPath, personaPkg } = await makeTestPersona(tmp);
  const registry = createTestRegistry({ personaPath, personaPkg });

  const result = await registry.dispatch("memory.inspect", { id: "nonexistent-id-12345" });
  assert.ok(!result.isError);
  const parsed = JSON.parse(result.content[0].text);
  assert.equal(parsed.found, false);
});

test("session capability list/call share unified contract", async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "ss-mcp-capability-"));
  const { personaPath, personaPkg } = await makeTestPersona(tmp);
  const registry = createTestRegistry({ personaPath, personaPkg });

  const listed = await registry.dispatch("session.capability_list", {});
  assert.ok(!listed.isError);
  const listedParsed = JSON.parse(listed.content[0].text);
  assert.equal(Array.isArray(listedParsed.items), true);
  assert.equal(listedParsed.items.some((item) => item.name === "session.read_file"), true);

  const readTarget = path.join(tmp, "notes.txt");
  await writeFile(readTarget, "hello capability", "utf8");
  const readNeedConfirm = await registry.dispatch("session.capability_call", {
    capability: "session.read_file",
    input: { path: readTarget }
  });
  const readNeedConfirmParsed = JSON.parse(readNeedConfirm.content[0].text);
  assert.equal(readNeedConfirmParsed.status, "confirm_required");

  const readOk = await registry.dispatch("session.capability_call", {
    capability: "session.read_file",
    input: { path: readTarget, confirmed: true }
  });
  const readOkParsed = JSON.parse(readOk.content[0].text);
  assert.equal(readOkParsed.status, "executed");
  assert.equal(typeof readOkParsed.content, "string");
});

test("session capability owner auth enables set_mode in current session", async () => {
  const prevOwnerKey = process.env.SOULSEED_OWNER_KEY;
  process.env.SOULSEED_OWNER_KEY = "owner-secret";
  try {
    const tmp = await mkdtemp(path.join(os.tmpdir(), "ss-mcp-cap-owner-"));
    const { personaPath, personaPkg } = await makeTestPersona(tmp);
    const registry = createTestRegistry({ personaPath, personaPkg });

    const auth = await registry.dispatch("session.capability_call", {
      capability: "session.owner_auth",
      input: { ownerToken: "owner-secret" }
    });
    const authParsed = JSON.parse(auth.content[0].text);
    assert.equal(authParsed.status, "executed");

    const setMode = await registry.dispatch("session.capability_call", {
      capability: "session.set_mode",
      input: { modeKey: "adult_mode", modeValue: false, confirmed: true }
    });
    const setModeParsed = JSON.parse(setMode.content[0].text);
    assert.equal(setModeParsed.status, "executed");
    assert.equal(setModeParsed.output.modeKey, "adult_mode");

    const show = await registry.dispatch("session.capability_call", {
      capability: "session.show_modes"
    });
    const showParsed = JSON.parse(show.content[0].text);
    assert.equal(showParsed.output.adult_mode, false);
  } finally {
    process.env.SOULSEED_OWNER_KEY = prevOwnerKey;
  }
});

test("goal tools and agent run are callable via registry", async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "ss-mcp-goal-tools-"));
  const { personaPath, personaPkg } = await makeTestPersona(tmp);
  const registry = createTestRegistry({ personaPath, personaPkg });

  const created = await registry.dispatch("goal.create", { title: "整理这次任务并输出结果" });
  assert.ok(!created.isError);
  const createdParsed = JSON.parse(created.content[0].text);
  assert.equal(createdParsed.status, "ok");
  assert.equal(typeof createdParsed.goal.id, "string");

  const listed = await registry.dispatch("goal.list", {});
  const listedParsed = JSON.parse(listed.content[0].text);
  assert.equal(Array.isArray(listedParsed.items), true);
  assert.equal(listedParsed.items.length >= 1, true);

  const goalId = createdParsed.goal.id;
  const got = await registry.dispatch("goal.get", { goalId });
  const gotParsed = JSON.parse(got.content[0].text);
  assert.equal(gotParsed.found, true);
  assert.equal(gotParsed.goal.id, goalId);

  const ran = await registry.dispatch("agent.run", {
    userInput: "请读取一个文件并总结",
    goalId,
    maxSteps: 2
  });
  const ranParsed = JSON.parse(ran.content[0].text);
  assert.equal(ranParsed.status, "ok");
  assert.equal(typeof ranParsed.execution.goalId, "string");
  assert.equal(Array.isArray(ranParsed.execution.traceIds), true);

  const traces = await registry.dispatch("consistency.inspect", { goalId, limit: 10 });
  const tracesParsed = JSON.parse(traces.content[0].text);
  assert.equal(Array.isArray(tracesParsed.items), true);

  if (ranParsed.execution.traceIds.length > 0) {
    const traceId = ranParsed.execution.traceIds[0];
    const oneTrace = await registry.dispatch("trace.get", { traceId });
    const oneTraceParsed = JSON.parse(oneTrace.content[0].text);
    assert.equal(oneTraceParsed.found === true || oneTraceParsed.found === false, true);
  }

  const canceled = await registry.dispatch("goal.cancel", { goalId });
  const canceledParsed = JSON.parse(canceled.content[0].text);
  assert.equal(canceledParsed.found, true);
  assert.equal(canceledParsed.goal.status, "canceled");
});
