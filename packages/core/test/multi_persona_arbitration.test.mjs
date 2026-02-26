import test from "node:test";
import assert from "node:assert/strict";

import {
  arbitrateMultiPersonaTurn,
  createDefaultGroupPolicy,
  createDefaultSpeakerRegistry
} from "../dist/index.js";

function makeCandidate(overrides) {
  return {
    actorId: "persona_a",
    displayName: "Persona A",
    addressingScore: 0,
    interestScore: 0,
    recentTurnCount: 0,
    cooldownActive: false,
    ...overrides
  };
}

function makeInput(candidates, policyOverrides) {
  const policy = createDefaultGroupPolicy();
  if (policyOverrides) {
    Object.assign(policy, policyOverrides);
    if (policyOverrides.turnScheduling) {
      Object.assign(policy.turnScheduling, policyOverrides.turnScheduling);
    }
  }
  return {
    userInput: "Hello everyone",
    registry: createDefaultSpeakerRegistry(),
    policy,
    candidates
  };
}

test("addressed persona wins over unaddressed", () => {
  const input = makeInput([
    makeCandidate({ actorId: "alice", displayName: "Alice", addressingScore: 0.9, interestScore: 0.3 }),
    makeCandidate({ actorId: "bob", displayName: "Bob", addressingScore: 0.1, interestScore: 0.8 })
  ]);

  const result = arbitrateMultiPersonaTurn(input);

  assert.equal(result.selectedActorId, "alice");

  const aliceDecision = result.decisions.find(d => d.actorId === "alice");
  const bobDecision = result.decisions.find(d => d.actorId === "bob");

  assert.equal(aliceDecision.mode, "speak");
  assert.ok(aliceDecision.score > bobDecision.score,
    `alice score ${aliceDecision.score} should exceed bob score ${bobDecision.score}`);
  assert.ok(result.reasonCodes.includes("selected_alice"));
});

test("cooldown penalty prevents monopoly", () => {
  const input = makeInput([
    makeCandidate({
      actorId: "monopolist",
      displayName: "Monopolist",
      addressingScore: 0.8,
      interestScore: 0.5,
      recentTurnCount: 3,
      cooldownActive: true
    }),
    makeCandidate({
      actorId: "fresh",
      displayName: "Fresh",
      addressingScore: 0.75,
      interestScore: 0.5,
      recentTurnCount: 0,
      cooldownActive: false
    })
  ]);

  const result = arbitrateMultiPersonaTurn(input);
  const monopolist = result.decisions.find(d => d.actorId === "monopolist");

  assert.ok(monopolist.reasonCodes.includes("cooldown_penalty"),
    "monopolist should have cooldown_penalty reason code");
  assert.notEqual(monopolist.mode, "speak",
    "monopolist should not speak after cooldown");
  assert.equal(result.selectedActorId, "fresh");
});

test("conflict resolution: highest score wins, tiebreak by actorId", () => {
  const input = makeInput([
    makeCandidate({ actorId: "beta", displayName: "Beta", addressingScore: 0.8, interestScore: 0.6 }),
    makeCandidate({ actorId: "alpha", displayName: "Alpha", addressingScore: 0.8, interestScore: 0.6 })
  ]);

  const result = arbitrateMultiPersonaTurn(input);

  assert.equal(result.selectedActorId, "alpha",
    "lexicographically first actorId wins tiebreak");
  assert.ok(result.reasonCodes.includes("conflict_resolved_by_score"));

  const loser = result.decisions.find(d => d.actorId === "beta");
  assert.equal(loser.mode, "brief_ack", "losing speaker demoted to brief_ack");
  assert.ok(loser.reasonCodes.includes("demoted_conflict_resolution"));
});

test("no-one-speaks when all scores below threshold", () => {
  const input = makeInput([
    makeCandidate({ actorId: "shy_a", displayName: "Shy A", addressingScore: 0.1, interestScore: 0.1 }),
    makeCandidate({ actorId: "shy_b", displayName: "Shy B", addressingScore: 0.05, interestScore: 0.2 })
  ]);

  const result = arbitrateMultiPersonaTurn(input);

  assert.equal(result.selectedActorId, null);
  assert.ok(result.reasonCodes.includes("no_speaker_qualified"));

  for (const d of result.decisions) {
    assert.notEqual(d.mode, "speak", `${d.actorId} should not be in speak mode`);
  }
});

test("empty candidates returns null with no_candidates reason", () => {
  const input = makeInput([]);
  const result = arbitrateMultiPersonaTurn(input);

  assert.equal(result.selectedActorId, null);
  assert.deepEqual(result.decisions, []);
  assert.ok(result.reasonCodes.includes("no_candidates"));
});

test("only one persona speaks even with many strong candidates", () => {
  const input = makeInput([
    makeCandidate({ actorId: "a", displayName: "A", addressingScore: 0.9, interestScore: 0.9 }),
    makeCandidate({ actorId: "b", displayName: "B", addressingScore: 0.85, interestScore: 0.8 }),
    makeCandidate({ actorId: "c", displayName: "C", addressingScore: 0.8, interestScore: 0.9 })
  ]);

  const result = arbitrateMultiPersonaTurn(input);

  const speakers = result.decisions.filter(d => d.mode === "speak");
  assert.equal(speakers.length, 1, "exactly one persona should speak");
  assert.equal(result.selectedActorId, speakers[0].actorId);
});
