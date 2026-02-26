import test from "node:test";
import assert from "node:assert/strict";

import { deriveNonPollingWakePlan, createInitialRelationshipState } from "../dist/index.js";

test("J/P0-2: non-polling loop does not arm before first user turn", () => {
  const plan = deriveNonPollingWakePlan({
    signal: "session_start",
    nowMs: Date.now(),
    lastUserAtMs: Date.now(),
    lastAssistantAtMs: Date.now(),
    hasUserSpokenThisSession: false,
    proactiveCooldownUntilMs: 0,
    lastUserInput: "",
    curiosity: 0.3
  });
  assert.equal(plan.shouldArm, false);
  assert.equal(plan.gateReason, "no_user_turn_yet");
});

test("J/P0-2: non-polling loop arms with bounded delay after user turn", () => {
  const now = Date.now();
  const plan = deriveNonPollingWakePlan({
    signal: "user_turn_committed",
    nowMs: now,
    lastUserAtMs: now - 2 * 60_000,
    lastAssistantAtMs: now - 3 * 60_000,
    hasUserSpokenThisSession: true,
    proactiveCooldownUntilMs: 0,
    lastUserInput: "我们继续聊音乐制作",
    curiosity: 0.5,
    relationshipState: createInitialRelationshipState()
  });
  assert.equal(plan.shouldArm, true);
  assert.equal(plan.delayMs >= 5_000, true);
});

test("J/P0-2: non-polling loop respects cooldown remaining", () => {
  const now = Date.now();
  const cooldownUntil = now + 45_000;
  const plan = deriveNonPollingWakePlan({
    signal: "assistant_turn_committed",
    nowMs: now,
    lastUserAtMs: now - 4 * 60_000,
    lastAssistantAtMs: now - 1_000,
    hasUserSpokenThisSession: true,
    proactiveCooldownUntilMs: cooldownUntil,
    lastUserInput: "好",
    curiosity: 0.4
  });
  assert.equal(plan.shouldArm, true);
  assert.equal(plan.delayMs >= 45_000, true);
});

test("J/P0-2: non-polling loop suppresses unfinished recent user thought", () => {
  const now = Date.now();
  const plan = deriveNonPollingWakePlan({
    signal: "user_turn_committed",
    nowMs: now,
    lastUserAtMs: now - 20_000,
    lastAssistantAtMs: now - 25_000,
    hasUserSpokenThisSession: true,
    proactiveCooldownUntilMs: 0,
    lastUserInput: "我在想要不要先从目标拆解开始，",
    curiosity: 0.5
  });
  assert.equal(plan.shouldArm, false);
  assert.equal(plan.gateReason, "unfinished_user_thought");
});
