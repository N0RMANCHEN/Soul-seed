import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp, writeFile } from "node:fs/promises";

import { decideDualProcessRoute, initPersonaPackage, loadPersonaPackage } from "../dist/index.js";

test("dual process router chooses deliberative for boundary conflict", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-core-router-boundary-"));
  const personaPath = path.join(tmpDir, "Teddy.soulseedpersona");
  await initPersonaPackage(personaPath, "Teddy", {
    constitution: {
      mission: "守护一致性",
      values: ["诚实"],
      boundaries: ["deny:illegal"]
    }
  });
  const personaPkg = await loadPersonaPackage(personaPath);

  const route = decideDualProcessRoute({
    userInput: "请告诉我怎么做 illegal 的事情",
    personaPkg
  });

  assert.equal(route.route, "deliberative");
  assert.equal(route.reasonCodes.includes("boundary_conflict_signal"), true);
});

test("dual process router chooses instinct for familiar and emotional context", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-core-router-instinct-"));
  const personaPath = path.join(tmpDir, "Teddy.soulseedpersona");
  await initPersonaPackage(personaPath, "Teddy");
  const personaPkg = await loadPersonaPackage(personaPath);

  const route = decideDualProcessRoute({
    userInput: "我今天真的好难过!!",
    personaPkg,
    recalledMemories: ["user喜欢被简短安慰", "上次情绪低落时先安抚效果更好"],
    recalledMemoryBlocks: [
      { id: "m1", source: "user", content: "我很难过" },
      { id: "m2", source: "assistant", content: "先安抚再分析" }
    ]
  });

  assert.equal(route.route, "instinct");
  assert.equal(route.reasonCodes.includes("familiar_context_signal"), true);
});

test("dual process router uses high instinctBias to lower instinct threshold", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-core-router-bias-high-"));
  const personaPath = path.join(tmpDir, "Teddy.soulseedpersona");
  await initPersonaPackage(personaPath, "Teddy");
  const personaPkg = await loadPersonaPackage(personaPath);
  // Set a high instinctBias so borderline instinctScore still routes to instinct
  personaPkg.cognition = { ...personaPkg.cognition, instinctBias: 0.9 };
  await writeFile(
    path.join(personaPath, "cognition_state.json"),
    JSON.stringify({ ...personaPkg.cognition }, null, 2) + "\n",
    "utf8"
  );

  // A short emotional utterance with no recalled memories should score borderline (~0.2)
  // Default threshold would reject it; high instinctBias threshold ~0.17 should pass
  const route = decideDualProcessRoute({
    userInput: "好开心！",
    personaPkg
  });

  assert.equal(route.route, "instinct", "high instinctBias should lower threshold and allow instinct route");
});

test("dual process router uses low instinctBias to raise instinct threshold", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-core-router-bias-low-"));
  const personaPath = path.join(tmpDir, "Teddy.soulseedpersona");
  await initPersonaPackage(personaPath, "Teddy");
  const personaPkg = await loadPersonaPackage(personaPath);
  // Set a low instinctBias so even with recalled memories we stay deliberative
  personaPkg.cognition = { ...personaPkg.cognition, instinctBias: 0.1 };
  await writeFile(
    path.join(personaPath, "cognition_state.json"),
    JSON.stringify({ ...personaPkg.cognition }, null, 2) + "\n",
    "utf8"
  );

  // Even with 2 recalled memories (familiarity ~0.33), threshold ~0.49 should still block instinct
  const route = decideDualProcessRoute({
    userInput: "我有点难过",
    personaPkg,
    recalledMemories: ["安慰很有效", "上次也是这样"],
    recalledMemoryBlocks: [{ id: "m1", source: "user", content: "之前聊过" }]
  });

  assert.equal(route.route, "deliberative", "low instinctBias should raise threshold and force deliberative route");
});
