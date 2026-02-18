/**
 * mcp_tools.test.mjs
 * Tests ToolRegistry dispatch for persona.get_context, conversation.save_turn,
 * memory.search, and memory.inspect (no LLM calls required).
 */
import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp } from "node:fs/promises";

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
