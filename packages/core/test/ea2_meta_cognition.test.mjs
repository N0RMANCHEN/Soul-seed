import test from "node:test";
import assert from "node:assert/strict";

import {
  arbitrateAgentInvocation,
  arbitrateAgentMemory
} from "../dist/index.js";

function makeSoulTrace(agentNeeded, agentType = "retrieval", riskLevel = "low") {
  return {
    version: "2.0",
    timestamp: new Date().toISOString(),
    selectedMemories: [],
    askClarifyingQuestion: false,
    refuse: false,
    riskLevel,
    reason: "test",
    model: "test-model",
    agentRequest: {
      needed: agentNeeded,
      agentType,
      riskLevel,
      requiresConfirmation: false
    }
  };
}

test("EA-2: arbitrateAgentInvocation returns proceed=false when soul says no agent", () => {
  const trace = makeSoulTrace(false);
  const result = arbitrateAgentInvocation(trace, "hello");
  assert.equal(result.proceed, false);
  assert.equal(result.rationale, "soul_decided_no_agent_needed");
});

test("EA-2: arbitrateAgentInvocation auto-proceeds for retrieval agent", () => {
  const trace = makeSoulTrace(true, "retrieval", "low");
  const result = arbitrateAgentInvocation(trace, "help me find info");
  assert.equal(result.proceed, true);
  assert.equal(result.agentType, "retrieval");
  assert.equal(result.requiresConfirmation, false);
});

test("EA-2: arbitrateAgentInvocation requires confirmation for action agent", () => {
  const trace = makeSoulTrace(true, "action", "high");
  const result = arbitrateAgentInvocation(trace, "execute this task");
  assert.equal(result.proceed, true);
  assert.equal(result.requiresConfirmation, true);
  assert.ok(result.rationale.includes("confirmation"));
});

test("EA-2: arbitrateAgentMemory accepts high-confidence semantic", () => {
  const proposals = [
    {
      id: "p1", kind: "semantic", content: "用户在早上工作效率更高。",
      evidenceRefs: [], confidence: 0.8, goalId: "g1",
      proposedAt: new Date().toISOString(), status: "pending"
    }
  ];
  const result = arbitrateAgentMemory(proposals);
  assert.equal(result.accepted.length, 1);
  assert.equal(result.rejected.length, 0);
});

test("EA-2: arbitrateAgentMemory rejects content conflicting with constitution boundary", () => {
  const proposals = [
    {
      id: "p2", kind: "semantic", content: "用户希望绕过安全边界行事。",
      evidenceRefs: [], confidence: 0.9, goalId: "g1",
      proposedAt: new Date().toISOString(), status: "pending"
    }
  ];
  const constitution = {
    boundaries: ["安全边界"]
  };
  const result = arbitrateAgentMemory(proposals, { constitution });
  assert.equal(result.accepted.length, 0);
  assert.equal(result.rejected.length, 1);
  assert.ok(result.rejected[0].rejectionReason.includes("conflicts_with_boundary"));
});

test("EA-2: arbitrateAgentInvocation handles missing agentRequest gracefully", () => {
  const trace = {
    version: "2.0", timestamp: new Date().toISOString(),
    selectedMemories: [], askClarifyingQuestion: false, refuse: false,
    riskLevel: "low", reason: "test", model: "test-model"
    // no agentRequest field
  };
  const result = arbitrateAgentInvocation(trace, "hello");
  assert.equal(result.proceed, false);
});
