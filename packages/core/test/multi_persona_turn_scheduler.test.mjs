import test from "node:test";
import assert from "node:assert/strict";

import {
  createInitialTurnState,
  scheduleTurn,
  getConsecutiveTurns,
  createDefaultGroupPolicy,
  createDefaultSpeakerRegistry
} from "../dist/index.js";

function makeRegistry(actorIds) {
  const reg = createDefaultSpeakerRegistry();
  reg.entries = actorIds.map((id) => ({
    actorId: id,
    actorLabel: id,
    role: "assistant",
    displayName: id,
    registeredAt: "2025-01-01T00:00:00.000Z"
  }));
  return reg;
}

function makePolicy(scheduling = {}) {
  const policy = createDefaultGroupPolicy();
  Object.assign(policy.turnScheduling, scheduling);
  return policy;
}

function makeArbitrationResult(selectedActorId, decisions = []) {
  return {
    selectedActorId,
    decisions,
    reasonCodes: selectedActorId
      ? [`selected_${selectedActorId}`]
      : ["no_speaker_qualified"]
  };
}

function makeDecision(actorId, score, mode = "speak") {
  return { actorId, mode, score, reasonCodes: [`mode_${mode}`] };
}

function stateWithHistory(actorIds) {
  return {
    history: actorIds.map((id, i) => ({
      actorId: id,
      turnIndex: i,
      timestamp: "2025-01-01T00:00:00.000Z"
    })),
    roundRobinPointer: 0,
    nextTurnIndex: actorIds.length,
    lastUpdatedAt: "2025-01-01T00:00:00.000Z"
  };
}

// ── strict_round_robin ──────────────────────────────────────

test("strict_round_robin cycles through participants", () => {
  const registry = makeRegistry(["alice", "bob", "carol"]);
  const policy = makePolicy({ mode: "strict_round_robin" });
  const arb = makeArbitrationResult("alice", [makeDecision("alice", 0.9)]);

  let state = createInitialTurnState();
  const selected = [];

  for (let i = 0; i < 6; i++) {
    const result = scheduleTurn({ state, policy, registry, arbitrationResult: arb });
    selected.push(result.selectedActorId);
    state = result.nextState;
  }

  assert.deepEqual(selected, ["alice", "bob", "carol", "alice", "bob", "carol"]);
});

test("strict_round_robin ignores arbitration scores", () => {
  const registry = makeRegistry(["alice", "bob"]);
  const policy = makePolicy({ mode: "strict_round_robin" });
  const arb = makeArbitrationResult("bob", [
    makeDecision("bob", 0.95),
    makeDecision("alice", 0.1)
  ]);

  const state = createInitialTurnState();
  const result = scheduleTurn({ state, policy, registry, arbitrationResult: arb });

  assert.equal(result.selectedActorId, "alice");
  assert.ok(result.reasonCodes.includes("mode_strict_round_robin"));
});

// ── round_robin_priority ────────────────────────────────────

test("round_robin_priority uses arbitration winner when under limit", () => {
  const registry = makeRegistry(["alice", "bob"]);
  const policy = makePolicy({ mode: "round_robin_priority", maxConsecutiveTurns: 2 });

  const state = stateWithHistory(["alice"]);
  const arb = makeArbitrationResult("alice", [
    makeDecision("alice", 0.9),
    makeDecision("bob", 0.7)
  ]);

  const result = scheduleTurn({ state, policy, registry, arbitrationResult: arb });

  assert.equal(result.selectedActorId, "alice");
  assert.equal(result.antiMonopolyApplied, false);
  assert.ok(result.reasonCodes.includes("arbitration_winner_alice"));
});

test("round_robin_priority skips monopolizer to next candidate", () => {
  const registry = makeRegistry(["alice", "bob"]);
  const policy = makePolicy({ mode: "round_robin_priority", maxConsecutiveTurns: 2 });

  const state = stateWithHistory(["alice", "alice"]);
  const arb = makeArbitrationResult("alice", [
    makeDecision("alice", 0.9),
    makeDecision("bob", 0.7)
  ]);

  const result = scheduleTurn({ state, policy, registry, arbitrationResult: arb });

  assert.equal(result.selectedActorId, "bob");
  assert.equal(result.antiMonopolyApplied, true);
  assert.ok(result.reasonCodes.includes("monopoly_blocked_alice"));
  assert.ok(result.reasonCodes.includes("fallback_selected_bob"));
});

// ── free_form ───────────────────────────────────────────────

test("free_form respects maxConsecutiveTurns", () => {
  const registry = makeRegistry(["alice", "bob"]);
  const policy = makePolicy({ mode: "free_form", maxConsecutiveTurns: 2 });

  const state = stateWithHistory(["alice", "alice"]);
  const arb = makeArbitrationResult("alice", [
    makeDecision("alice", 0.95),
    makeDecision("bob", 0.6)
  ]);

  const result = scheduleTurn({ state, policy, registry, arbitrationResult: arb });

  assert.equal(result.selectedActorId, "bob");
  assert.equal(result.antiMonopolyApplied, true);
  assert.ok(result.reasonCodes.includes("mode_free_form"));
  assert.ok(result.reasonCodes.includes("monopoly_blocked_alice"));
});

test("free_form allows winner when under limit", () => {
  const registry = makeRegistry(["alice", "bob"]);
  const policy = makePolicy({ mode: "free_form", maxConsecutiveTurns: 3 });

  const state = stateWithHistory(["alice", "alice"]);
  const arb = makeArbitrationResult("alice", [makeDecision("alice", 0.9)]);

  const result = scheduleTurn({ state, policy, registry, arbitrationResult: arb });

  assert.equal(result.selectedActorId, "alice");
  assert.equal(result.antiMonopolyApplied, false);
});

// ── anti-monopoly flag ──────────────────────────────────────

test("anti-monopoly flag true when speaker skipped, false otherwise", () => {
  const registry = makeRegistry(["alice", "bob"]);
  const policy = makePolicy({ mode: "round_robin_priority", maxConsecutiveTurns: 2 });

  const state = stateWithHistory(["alice", "alice"]);
  const arb = makeArbitrationResult("alice", [
    makeDecision("alice", 0.9),
    makeDecision("bob", 0.7)
  ]);

  const r1 = scheduleTurn({ state, policy, registry, arbitrationResult: arb });
  assert.equal(r1.antiMonopolyApplied, true);
  assert.equal(r1.selectedActorId, "bob");

  const arb2 = makeArbitrationResult("bob", [makeDecision("bob", 0.8)]);
  const r2 = scheduleTurn({
    state: r1.nextState,
    policy,
    registry,
    arbitrationResult: arb2
  });
  assert.equal(r2.antiMonopolyApplied, false);
  assert.equal(r2.selectedActorId, "bob");
});

// ── history trimming ────────────────────────────────────────

test("history trimmed to 50 entries with monotonic turnIndex", () => {
  const registry = makeRegistry(["alice", "bob"]);
  const policy = makePolicy({ mode: "strict_round_robin" });
  const arb = makeArbitrationResult(null, []);

  const records = Array.from({ length: 50 }, (_, i) =>
    i % 2 === 0 ? "alice" : "bob"
  );
  const state = stateWithHistory(records);
  assert.equal(state.history.length, 50);
  assert.equal(state.nextTurnIndex, 50);

  const result = scheduleTurn({ state, policy, registry, arbitrationResult: arb });
  assert.equal(result.nextState.history.length, 50);
  const lastEntry = result.nextState.history[result.nextState.history.length - 1];
  assert.equal(lastEntry.turnIndex, 50);
  assert.equal(result.nextState.nextTurnIndex, 51);
});

// ── getConsecutiveTurns ─────────────────────────────────────

test("getConsecutiveTurns counts trailing runs correctly", () => {
  const history = [
    { actorId: "alice", turnIndex: 0, timestamp: "t0" },
    { actorId: "bob", turnIndex: 1, timestamp: "t1" },
    { actorId: "alice", turnIndex: 2, timestamp: "t2" },
    { actorId: "alice", turnIndex: 3, timestamp: "t3" }
  ];

  assert.equal(getConsecutiveTurns(history, "alice"), 2);
  assert.equal(getConsecutiveTurns(history, "bob"), 0);
  assert.equal(getConsecutiveTurns([], "alice"), 0);
});

// ── edge cases ──────────────────────────────────────────────

test("no registered personas returns null", () => {
  const registry = makeRegistry([]);
  const policy = makePolicy();
  const arb = makeArbitrationResult(null, []);
  const state = createInitialTurnState();

  const result = scheduleTurn({ state, policy, registry, arbitrationResult: arb });

  assert.equal(result.selectedActorId, null);
  assert.ok(result.reasonCodes.includes("no_registered_personas"));
  assert.equal(result.antiMonopolyApplied, false);
});

test("null arbitration winner in round_robin_priority falls back to rr", () => {
  const registry = makeRegistry(["alice", "bob"]);
  const policy = makePolicy({ mode: "round_robin_priority", maxConsecutiveTurns: 2 });
  const state = createInitialTurnState();
  const arb = makeArbitrationResult(null, []);

  const result = scheduleTurn({ state, policy, registry, arbitrationResult: arb });

  assert.ok(result.selectedActorId !== null);
  assert.ok(result.reasonCodes.includes("rr_fallback_alice"));
});
