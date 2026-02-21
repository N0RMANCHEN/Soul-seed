import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp } from "node:fs/promises";

import {
  AGENT_TOOL_WHITELIST,
  isToolAllowedForAgentType,
  runAgentExecution,
  initPersonaPackage,
  loadPersonaPackage
} from "../dist/index.js";

test("EA-3: AGENT_TOOL_WHITELIST defines whitelist for each type", () => {
  assert.ok(Array.isArray(AGENT_TOOL_WHITELIST.retrieval), "retrieval whitelist should be an array");
  assert.ok(Array.isArray(AGENT_TOOL_WHITELIST.transform), "transform whitelist should be an array");
  assert.ok(Array.isArray(AGENT_TOOL_WHITELIST.capture), "capture whitelist should be an array");
  assert.ok(Array.isArray(AGENT_TOOL_WHITELIST.action), "action whitelist should be an array (empty=unrestricted)");
  assert.ok(AGENT_TOOL_WHITELIST.retrieval.includes("memory.search"), "retrieval should allow memory.search");
  assert.ok(AGENT_TOOL_WHITELIST.retrieval.includes("session.read_file"), "retrieval should allow session.read_file");
});

test("EA-3: isToolAllowedForAgentType returns correct results", () => {
  // retrieval can read
  assert.equal(isToolAllowedForAgentType("memory.search", "retrieval"), true);
  assert.equal(isToolAllowedForAgentType("session.fetch_url", "retrieval"), true);
  // retrieval cannot log events
  assert.equal(isToolAllowedForAgentType("session.log_event", "retrieval"), false);
  // transform cannot log events
  assert.equal(isToolAllowedForAgentType("session.log_event", "transform"), false);
  // capture can only log
  assert.equal(isToolAllowedForAgentType("session.log_event", "capture"), true);
  assert.equal(isToolAllowedForAgentType("memory.search", "capture"), false);
  // action agent has no restriction
  assert.equal(isToolAllowedForAgentType("anything.tool", "action"), true);
  assert.equal(isToolAllowedForAgentType("session.log_event", "action"), true);
});

test("EA-3: retrieval agent blocks disallowed tools during execution", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-ea3-block-"));
  const personaPath = path.join(tmpDir, "TestEA3.soulseedpersona");
  await initPersonaPackage(personaPath, "TestEA3");
  const personaPkg = await loadPersonaPackage(personaPath);

  // Use a mock tool executor that tries to run a disallowed tool
  const calledTools = [];
  const mockExecutor = {
    run: async ({ toolName }) => {
      calledTools.push(toolName);
      return { ok: true, summary: "tool_ran", output: { result: "data" } };
    }
  };

  // This should block because retrieval agent cannot write
  const result = await runAgentExecution({
    rootPath: personaPath,
    personaPkg,
    userInput: "执行任务",
    agentType: "retrieval",
    toolExecutor: mockExecutor,
    maxSteps: 1
  });

  // The test passes as long as the whitelist check happens; actual blocking
  // depends on whether the planner tries a disallowed tool
  assert.ok(result.goalId.length > 0, "execution should produce a goal");
  // Disallowed tools should NOT be in calledTools
  for (const tool of calledTools) {
    assert.ok(
      isToolAllowedForAgentType(tool, "retrieval"),
      `tool "${tool}" should not have been called for retrieval agent`
    );
  }
});

test("EA-3: action agent allows all tools", () => {
  const tools = ["memory.search", "session.read_file", "session.log_event", "session.execute", "custom.tool"];
  for (const tool of tools) {
    assert.equal(isToolAllowedForAgentType(tool, "action"), true, `action agent should allow ${tool}`);
  }
});
