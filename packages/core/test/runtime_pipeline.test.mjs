import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp } from "node:fs/promises";

import { executeTurnProtocol, initPersonaPackage, loadPersonaPackage } from "../dist/index.js";

test("runtime pipeline emits five ordered stages in soul mode", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-core-runtime-pipeline-soul-"));
  const personaPath = path.join(tmpDir, "Teddy.soulseedpersona");
  await initPersonaPackage(personaPath, "Teddy");
  const personaPkg = await loadPersonaPackage(personaPath);

  const turn = await executeTurnProtocol({
    rootPath: personaPath,
    personaPkg,
    userInput: "你好",
    model: "deepseek-chat",
    lifeEvents: [],
    mode: "auto"
  });

  assert.equal(turn.mode, "soul");
  assert.equal(Array.isArray(turn.pipelineStages), true);
  assert.equal(turn.trace?.routeDecision, "deliberative");
  assert.equal(Array.isArray(turn.trace?.routeReasonCodes), true);
  assert.deepEqual(
    turn.pipelineStages.map((item) => item.stage),
    ["perception", "idea", "deliberation", "meta_review", "commit"]
  );
  assert.equal(turn.pipelineStages[1]?.summary.includes("route:deliberative"), true);
});

test("runtime pipeline emits five ordered stages in agent mode", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-core-runtime-pipeline-agent-"));
  const personaPath = path.join(tmpDir, "Teddy.soulseedpersona");
  await initPersonaPackage(personaPath, "Teddy");
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
  assert.equal(turn.execution != null, true);
  assert.equal(turn.trace?.routeDecision, "deliberative");
  assert.equal(Array.isArray(turn.trace?.routeReasonCodes), true);
  assert.equal(Array.isArray(turn.pipelineStages), true);
  assert.deepEqual(
    turn.pipelineStages.map((item) => item.stage),
    ["perception", "idea", "deliberation", "meta_review", "commit"]
  );
});
