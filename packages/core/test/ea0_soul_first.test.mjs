import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp } from "node:fs/promises";

import { executeTurnProtocol, initPersonaPackage, loadPersonaPackage } from "../dist/index.js";

test("EA-0: soul trace is always present even in agent mode", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-ea0-agent-trace-"));
  const personaPath = path.join(tmpDir, "TestEA0.soulseedpersona");
  await initPersonaPackage(personaPath, "TestEA0");
  const personaPkg = await loadPersonaPackage(personaPath);

  const turn = await executeTurnProtocol({
    rootPath: personaPath,
    personaPkg,
    userInput: "请帮我制定一个执行计划",
    model: "deepseek-chat",
    lifeEvents: [],
    mode: "auto",
    maxSteps: 2
  });

  assert.equal(turn.mode, "agent");
  // EA-0: soul trace must not be null in agent mode
  assert.ok(turn.trace !== null, "soul trace should be present in agent mode");
  assert.ok(turn.trace?.agentRequest !== undefined, "agentRequest should be set on soul trace");
  assert.equal(turn.trace?.agentRequest?.needed, true, "agentRequest.needed should be true");
  assert.equal(turn.trace?.routeDecision, "deliberative");
});

test("EA-0: soul trace is present and agentRequest.needed=false in soul mode", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-ea0-soul-trace-"));
  const personaPath = path.join(tmpDir, "TestEA0Soul.soulseedpersona");
  await initPersonaPackage(personaPath, "TestEA0Soul");
  const personaPkg = await loadPersonaPackage(personaPath);

  const turn = await executeTurnProtocol({
    rootPath: personaPath,
    personaPkg,
    userInput: "你好",
    model: "deepseek-chat",
    lifeEvents: [],
    mode: "soul"
  });

  assert.equal(turn.mode, "soul");
  assert.ok(turn.trace !== null, "soul trace should be present");
  assert.ok(turn.trace?.agentRequest !== undefined, "agentRequest should be set");
  assert.equal(turn.trace?.agentRequest?.needed, false, "agentRequest.needed should be false");
});

test("EA-0: pipeline stages order is maintained in both modes", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-ea0-stages-"));
  const personaPath = path.join(tmpDir, "TestEA0Stages.soulseedpersona");
  await initPersonaPackage(personaPath, "TestEA0Stages");
  const personaPkg = await loadPersonaPackage(personaPath);

  const soulTurn = await executeTurnProtocol({
    rootPath: personaPath, personaPkg, userInput: "你好", model: "deepseek-chat",
    lifeEvents: [], mode: "soul"
  });
  const agentTurn = await executeTurnProtocol({
    rootPath: personaPath, personaPkg, userInput: "请帮我写计划", model: "deepseek-chat",
    lifeEvents: [], mode: "auto", maxSteps: 1
  });

  const expectedStages = ["perception", "idea", "deliberation", "meta_review", "commit"];
  assert.deepEqual(soulTurn.pipelineStages.map(s => s.stage), expectedStages);
  assert.deepEqual(agentTurn.pipelineStages.map(s => s.stage), expectedStages);
});

test("EA-0: agent execution result has soulTraceId reference", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-ea0-link-"));
  const personaPath = path.join(tmpDir, "TestEA0Link.soulseedpersona");
  await initPersonaPackage(personaPath, "TestEA0Link");
  const personaPkg = await loadPersonaPackage(personaPath);

  const turn = await executeTurnProtocol({
    rootPath: personaPath, personaPkg,
    userInput: "请帮我实现一个功能", model: "deepseek-chat",
    lifeEvents: [], mode: "agent", maxSteps: 1
  });

  assert.equal(turn.mode, "agent");
  assert.ok(turn.trace !== null, "soul trace must exist");
  // soulTraceId may be undefined if recallTraceId was not set, but the field exists on execution
  if (turn.execution) {
    assert.ok("soulTraceId" in turn.execution, "soulTraceId field should exist on execution result");
  }
});
