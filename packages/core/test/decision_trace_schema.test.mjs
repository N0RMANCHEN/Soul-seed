import test from "node:test";
import assert from "node:assert/strict";

import {
  DECISION_TRACE_SCHEMA_VERSION,
  normalizeDecisionTrace
} from "../dist/index.js";

test("normalizeDecisionTrace upgrades legacy version into current schema", () => {
  const normalized = normalizeDecisionTrace({
    version: "0.1.0",
    timestamp: "2026-02-17T00:00:00.000Z",
    selectedMemories: ["life=hello"],
    askClarifyingQuestion: true,
    refuse: false,
    riskLevel: "low",
    reason: "legacy",
    model: "mock-adapter"
  });

  assert.equal(normalized.version, DECISION_TRACE_SCHEMA_VERSION);
  assert.equal(normalized.askClarifyingQuestion, true);
  assert.equal(normalized.refuse, false);
  assert.equal(normalized.riskLevel, "low");
  assert.deepEqual(normalized.selectedMemories, ["life=hello"]);
});

test("normalizeDecisionTrace rejects unsupported version", () => {
  assert.throws(
    () =>
      normalizeDecisionTrace({
        version: "9.9.9"
      }),
    /Unsupported DecisionTrace version/
  );
});

test("normalizeDecisionTrace keeps execution and consistency fields", () => {
  const normalized = normalizeDecisionTrace({
    version: DECISION_TRACE_SCHEMA_VERSION,
    timestamp: "2026-02-20T00:00:00.000Z",
    selectedMemories: [],
    askClarifyingQuestion: false,
    refuse: false,
    riskLevel: "low",
    reason: "agent run",
    model: "deepseek-chat",
    executionMode: "agent",
    goalId: "goal_1",
    stepId: "step_1",
    planVersion: 2,
    consistencyVerdict: "allow",
    consistencyRuleHits: ["identity", "relational"],
    consistencyTraceId: "trace_1",
    routeDecision: "deliberative",
    routeReasonCodes: ["task_like_signal", "moderate_risk_signal"]
  });

  assert.equal(normalized.executionMode, "agent");
  assert.equal(normalized.goalId, "goal_1");
  assert.equal(normalized.stepId, "step_1");
  assert.equal(normalized.planVersion, 2);
  assert.equal(normalized.consistencyVerdict, "allow");
  assert.deepEqual(normalized.consistencyRuleHits, ["identity", "relational"]);
  assert.equal(normalized.consistencyTraceId, "trace_1");
  assert.equal(normalized.routeDecision, "deliberative");
  assert.deepEqual(normalized.routeReasonCodes, ["task_like_signal", "moderate_risk_signal"]);
});

test("normalizeDecisionTrace keeps conversation control fields", () => {
  const normalized = normalizeDecisionTrace({
    version: DECISION_TRACE_SCHEMA_VERSION,
    timestamp: "2026-02-24T00:00:00.000Z",
    selectedMemories: [],
    askClarifyingQuestion: false,
    refuse: false,
    riskLevel: "low",
    reason: "control",
    model: "deepseek-chat",
    conversationControl: {
      engagementTier: "NORMAL",
      topicAction: "maintain",
      responsePolicy: "normal_response",
      reasonCodes: ["task_intent_detected"]
    }
  });

  assert.equal(normalized.conversationControl?.engagementTier, "NORMAL");
  assert.equal(normalized.conversationControl?.topicAction, "maintain");
  assert.equal(normalized.conversationControl?.responsePolicy, "normal_response");
  assert.deepEqual(normalized.conversationControl?.reasonCodes, ["task_intent_detected"]);
});

test("normalizeDecisionTrace keeps group participation control fields", () => {
  const normalized = normalizeDecisionTrace({
    version: DECISION_TRACE_SCHEMA_VERSION,
    timestamp: "2026-02-24T00:00:00.000Z",
    selectedMemories: [],
    askClarifyingQuestion: false,
    refuse: false,
    riskLevel: "low",
    reason: "group-control",
    model: "deepseek-chat",
    conversationControl: {
      engagementTier: "LIGHT",
      topicAction: "maintain",
      responsePolicy: "light_response",
      reasonCodes: ["addressing_detected"],
      groupParticipation: {
        mode: "brief_ack",
        score: 0.55,
        isGroupChat: true,
        addressedToAssistant: true,
        cooldownHit: true,
        consecutiveAssistantTurns: 3,
        reasonCodes: ["group_chat_detected", "consecutive_assistant_cooldown"]
      }
    }
  });

  assert.equal(normalized.conversationControl?.groupParticipation?.mode, "brief_ack");
  assert.equal(normalized.conversationControl?.groupParticipation?.isGroupChat, true);
  assert.equal(normalized.conversationControl?.groupParticipation?.addressedToAssistant, true);
  assert.equal(normalized.conversationControl?.groupParticipation?.cooldownHit, true);
  assert.equal(normalized.conversationControl?.groupParticipation?.consecutiveAssistantTurns, 3);
});
