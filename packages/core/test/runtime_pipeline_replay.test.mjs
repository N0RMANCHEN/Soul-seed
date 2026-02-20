import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp } from "node:fs/promises";

import {
  initPersonaPackage,
  loadPersonaPackage,
  runPipelineStageReplayHarness
} from "../dist/index.js";

const EXPECTED_STAGES = ["perception", "idea", "deliberation", "meta_review", "commit"];

test("soul mode: 5 stages in correct order", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-pipeline-replay-soul-"));
  const personaPath = path.join(tmpDir, "Teddy.soulseedpersona");
  await initPersonaPackage(personaPath, "Teddy");
  const personaPkg = await loadPersonaPackage(personaPath);

  const results = await runPipelineStageReplayHarness(
    personaPath,
    personaPkg,
    [{ userInput: "你好", mode: "soul", expectedMode: "soul" }],
    { model: "mock-adapter" }
  );

  assert.equal(results.length, 1);
  const result = results[0];
  assert.deepEqual(
    result.stages.map((s) => s.stage),
    EXPECTED_STAGES
  );
  assert.equal(result.pass, true);
  assert.equal(result.mismatches.length, 0);
});

test("agent mode with mock planner: 5 stages in correct order", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-pipeline-replay-agent-"));
  const personaPath = path.join(tmpDir, "Teddy.soulseedpersona");
  await initPersonaPackage(personaPath, "Teddy");
  const personaPkg = await loadPersonaPackage(personaPath);

  const plannerAdapter = {
    name: "mock-planner",
    async streamChat() {
      return {
        content: JSON.stringify({
          steps: [{ kind: "complete", reason: "done", replyDraft: "完成。" }]
        })
      };
    }
  };

  const results = await runPipelineStageReplayHarness(
    personaPath,
    personaPkg,
    [{ userInput: "帮我规划任务", mode: "agent", plannerAdapter, expectedMode: "agent" }],
    { model: "mock-adapter" }
  );

  assert.equal(results.length, 1);
  const result = results[0];
  assert.equal(result.mode, "agent");
  assert.deepEqual(
    result.stages.map((s) => s.stage),
    EXPECTED_STAGES
  );
  assert.equal(result.pass, true);
  assert.equal(result.mismatches.length, 0);
});

test("detects wrong expected stage order", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-pipeline-replay-wrong-"));
  const personaPath = path.join(tmpDir, "Teddy.soulseedpersona");
  await initPersonaPackage(personaPath, "Teddy");
  const personaPkg = await loadPersonaPackage(personaPath);

  const results = await runPipelineStageReplayHarness(
    personaPath,
    personaPkg,
    [
      {
        userInput: "你好",
        mode: "soul",
        expectedStageOrder: ["perception", "deliberation", "idea", "meta_review", "commit"]
      }
    ],
    { model: "mock-adapter" }
  );

  assert.equal(results.length, 1);
  const result = results[0];
  assert.equal(result.pass, false);
  assert.equal(result.mismatches.length > 0, true);
  assert.match(result.mismatches[0], /stageOrder/);
});

test("validates route decision field", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-pipeline-replay-route-"));
  const personaPath = path.join(tmpDir, "Teddy.soulseedpersona");
  await initPersonaPackage(personaPath, "Teddy");
  const personaPkg = await loadPersonaPackage(personaPath);

  const results = await runPipelineStageReplayHarness(
    personaPath,
    personaPkg,
    [{ userInput: "你好", mode: "soul", expectedRoute: "deliberative" }],
    { model: "mock-adapter" }
  );

  assert.equal(results.length, 1);
  const result = results[0];
  assert.equal(result.route, "deliberative");
  assert.equal(result.pass, true);
});
