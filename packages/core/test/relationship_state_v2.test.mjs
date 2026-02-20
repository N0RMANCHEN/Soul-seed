import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";

import {
  createInitialRelationshipState,
  applyArousalBiasToMemoryWeights,
  deriveVoiceIntent,
  isImpulseWindowActive,
  evolveRelationshipState,
  evolveRelationshipStateFromAssistant,
  initPersonaPackage,
  loadPersonaPackage
} from "../dist/index.js";

test("legacy relationship_state.json is auto-migrated to v3 shape", async () => {
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
  assert.equal(pkg.relationshipState?.version, "3");
  assert.equal(typeof pkg.relationshipState?.dimensions.trust, "number");
  assert.equal(typeof pkg.relationshipState?.dimensions.libido, "number");
  assert.equal(Array.isArray(pkg.relationshipState?.drivers), true);

  const persisted = JSON.parse(await readFile(path.join(personaPath, "relationship_state.json"), "utf8"));
  assert.equal(persisted.version, "3");
  assert.equal(typeof persisted.overall, "number");
  assert.equal(typeof persisted.dimensions.libido, "number");
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

test("libido reacts to explicit desire signals", () => {
  const current = createInitialRelationshipState();
  const next = evolveRelationshipState(current, "我现在有性欲，想要你。", []);
  assert.equal(next.dimensions.libido > current.dimensions.libido, true);
});

test("resolution signals reduce libido after arousal", () => {
  let state = createInitialRelationshipState();
  state = evolveRelationshipState(state, "我现在很有性欲，想要你。", []);
  const before = state.dimensions.libido;
  const next = evolveRelationshipState(state, "我满足了，结束了。", []);
  assert.equal(next.dimensions.libido < before, true);
});

test("high libido shifts memory weights toward emotion and away from rational channels", () => {
  const state = {
    ...createInitialRelationshipState(),
    dimensions: {
      ...createInitialRelationshipState().dimensions,
      libido: 0.92
    }
  };
  const before = {
    activation: 0.25,
    emotion: 0.25,
    narrative: 0.25,
    relational: 0.25
  };
  const after = applyArousalBiasToMemoryWeights(before, state);
  assert.equal(after.emotion > before.emotion, true);
  assert.equal(after.activation < before.activation, true);
  assert.equal(after.narrative < before.narrative, true);
});

// P0-1 regression: high-intimacy state should be classified as "intimate"
test("computeOverall weights (P0-1): intimacy=0.82 gives state=intimate", () => {
  // Roxy's actual dimensions as of 2026-02-21
  const base = createInitialRelationshipState();
  const state = {
    ...base,
    dimensions: {
      trust: 0.535,
      safety: 0.78,
      intimacy: 0.82,
      reciprocity: 0.74,
      stability: 0.692,
      libido: 0.62
    }
  };
  // evolveRelationshipState recomputes overall/state each turn
  const next = evolveRelationshipState(state, "嗯", []);
  assert.equal(
    next.state,
    "intimate",
    `Expected intimate but got ${next.state} (overall=${next.overall}); new weight formula should give ≥0.70`
  );
  assert.ok(next.overall >= 0.70, `overall should be ≥0.70, got ${next.overall}`);
});

test("computeOverall weights (P0-1): initial state stays below peer threshold", () => {
  const state = createInitialRelationshipState();
  assert.notEqual(state.state, "intimate");
  assert.notEqual(state.state, "peer");
});

test("impulse window opens under high libido and intimacy", () => {
  let state = createInitialRelationshipState();
  state = evolveRelationshipState(state, "我现在有性欲，想要你。", []);
  state = evolveRelationshipState(state, "我们来点情调和暧昧。", []);
  state = {
    ...state,
    dimensions: {
      ...state.dimensions,
      libido: 0.92,
      intimacy: 0.45
    }
  };
  assert.equal(isImpulseWindowActive(state), true);
});
