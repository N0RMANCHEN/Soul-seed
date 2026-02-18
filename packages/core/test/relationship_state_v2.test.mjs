import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";

import {
  createInitialRelationshipState,
  deriveVoiceIntent,
  evolveRelationshipState,
  evolveRelationshipStateFromAssistant,
  initPersonaPackage,
  loadPersonaPackage
} from "../dist/index.js";

test("legacy relationship_state.json is auto-migrated to v2 shape", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-rel-v2-migrate-"));
  const personaPath = path.join(tmpDir, "Roxy.soulseedpersona");
  await initPersonaPackage(personaPath, "Roxy");

  await writeFile(
    path.join(personaPath, "relationship_state.json"),
    JSON.stringify({
      state: "friend",
      confidence: 0.78,
      updatedAt: "2026-02-17T00:00:00.000Z"
    }),
    "utf8"
  );

  const pkg = await loadPersonaPackage(personaPath);
  assert.equal(pkg.relationshipState?.version, "2");
  assert.equal(typeof pkg.relationshipState?.dimensions.trust, "number");
  assert.equal(Array.isArray(pkg.relationshipState?.drivers), true);

  const persisted = JSON.parse(await readFile(path.join(personaPath, "relationship_state.json"), "utf8"));
  assert.equal(persisted.version, "2");
  assert.equal(typeof persisted.overall, "number");
});

test("user positive input increases trust/safety", () => {
  const current = createInitialRelationshipState();
  const next = evolveRelationshipState(current, "谢谢你，我很信任你，我们一起做完它。", []);
  assert.equal(next.dimensions.trust > current.dimensions.trust, true);
  assert.equal(next.dimensions.safety > current.dimensions.safety, true);
});

test("assistant aborted/conflict events reduce stability and trust", () => {
  const current = createInitialRelationshipState();
  const next = evolveRelationshipStateFromAssistant(
    current,
    "短答复",
    [
      { type: "assistant_aborted" },
      { type: "conflict_logged" }
    ]
  );
  assert.equal(next.dimensions.stability < current.dimensions.stability, true);
  assert.equal(next.dimensions.trust < current.dimensions.trust, true);
});

test("confidence is dynamic across turns, not fixed constant", () => {
  let state = createInitialRelationshipState();
  const c0 = state.confidence;
  state = evolveRelationshipState(state, "谢谢你，我很信任你。", []);
  state = evolveRelationshipStateFromAssistant(state, "我理解你，你是指这个点吗？", []);
  const c1 = state.confidence;
  state = evolveRelationshipState(state, "你真笨，烦死了。", []);
  const c2 = state.confidence;
  assert.notEqual(c1, c0);
  assert.notEqual(c2, c1);
});

test("active conversation does not decay toward baseline per turn", () => {
  let state = createInitialRelationshipState();
  state = evolveRelationshipState(state, "谢谢你，我很信任你，我们一起做完它。", []);
  const trustBefore = state.dimensions.trust;
  const safetyBefore = state.dimensions.safety;
  const next = evolveRelationshipState(state, "嗯", []);
  assert.equal(next.dimensions.trust, trustBefore);
  assert.equal(next.dimensions.safety, safetyBefore);
});

test("idle duration triggers decay toward baseline", () => {
  let state = createInitialRelationshipState();
  state = evolveRelationshipState(state, "谢谢你，我很信任你，我们一起做完它。", []);
  const trustBefore = state.dimensions.trust;
  const safetyBefore = state.dimensions.safety;
  const staleState = {
    ...state,
    updatedAt: new Date(Date.now() - (2 * 60 * 60 * 1000)).toISOString()
  };
  const next = evolveRelationshipState(staleState, "继续", []);
  assert.equal(next.dimensions.trust < trustBefore, true);
  assert.equal(next.dimensions.safety < safetyBefore, true);
});

test("deriveVoiceIntent falls back to preferredLanguage when input has weak signal", () => {
  const intent = deriveVoiceIntent({
    relationshipState: createInitialRelationshipState(),
    userInput: "....",
    preferredLanguage: "zh-CN"
  });
  assert.equal(intent.language, "zh");
});
