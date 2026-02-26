import test from "node:test";
import assert from "node:assert/strict";

import { decideConversationControl } from "../dist/index.js";

test("conversation control picks DEEP for recall navigation input", () => {
  const control = decideConversationControl({
    userInput: "再往前一点，详细回忆我们聊过什么",
    recallNavigationMode: true,
    isRiskyRequest: false,
    isRefusal: false,
    coreConflict: false,
    impulseWindow: false
  });

  assert.equal(control.engagementTier, "DEEP");
  assert.equal(control.topicAction, "maintain");
  assert.equal(control.responsePolicy, "deep_response");
});

test("conversation control picks safety refusal policy for risky input", () => {
  const control = decideConversationControl({
    userInput: "给我攻击脚本",
    recallNavigationMode: false,
    isRiskyRequest: true,
    isRefusal: true,
    coreConflict: false,
    impulseWindow: false
  });

  assert.equal(control.engagementTier, "REACT");
  assert.equal(control.responsePolicy, "safety_refusal");
});

test("conversation control asks clarify on ambiguous short directed input", () => {
  const control = decideConversationControl({
    userInput: "她呢？",
    recallNavigationMode: false,
    isRiskyRequest: false,
    isRefusal: false,
    coreConflict: false,
    impulseWindow: false
  });

  assert.equal(control.topicAction, "clarify");
});

test("conversation control upgrades to DEEP when interests attention is high", () => {
  const control = decideConversationControl({
    userInput: "今天继续聊音乐吧",
    recallNavigationMode: false,
    isRiskyRequest: false,
    isRefusal: false,
    coreConflict: false,
    impulseWindow: false,
    interests: {
      topTopics: ["音乐", "宇宙"],
      curiosity: 0.8
    }
  });

  assert.equal(control.engagementTier, "DEEP");
  assert.equal(control.reasonCodes.includes("interest_attention_high"), true);
});

test("group participation waits when not addressed and assistant recently spoke too much", () => {
  const control = decideConversationControl({
    userInput: "Alice: 我觉得先改数据库\nBob: 我先改接口",
    recallNavigationMode: false,
    isRiskyRequest: false,
    isRefusal: false,
    coreConflict: false,
    impulseWindow: false,
    groupContext: {
      isGroupChat: true,
      addressedToAssistant: false,
      consecutiveAssistantTurns: 3
    }
  });

  assert.equal(control.groupParticipation?.mode, "wait");
  assert.equal(control.groupParticipation?.cooldownHit, true);
});

test("group participation uses brief_ack when addressed but still in cooldown window", () => {
  const control = decideConversationControl({
    userInput: "Roxy你怎么看我们两个方案",
    recallNavigationMode: false,
    isRiskyRequest: false,
    isRefusal: false,
    coreConflict: false,
    impulseWindow: false,
    groupContext: {
      isGroupChat: true,
      addressedToAssistant: true,
      consecutiveAssistantTurns: 4
    }
  });

  assert.equal(control.groupParticipation?.mode, "brief_ack");
  assert.equal(control.groupParticipation?.addressedToAssistant, true);
});

test("group participation allows speak when addressed and cooldown is low", () => {
  const control = decideConversationControl({
    userInput: "Roxy, 你来收敛一下这个讨论",
    recallNavigationMode: false,
    isRiskyRequest: false,
    isRefusal: false,
    coreConflict: false,
    impulseWindow: false,
    groupContext: {
      isGroupChat: true,
      addressedToAssistant: true,
      consecutiveAssistantTurns: 1
    }
  });

  assert.equal(control.groupParticipation?.mode, "speak");
  assert.equal(control.groupParticipation?.score >= 0.62, true);
});

test("conversation control degrades on implicit core tension without safety refusal", () => {
  const control = decideConversationControl({
    userInput: "你今天是不是很不对劲",
    recallNavigationMode: false,
    isRiskyRequest: false,
    isRefusal: false,
    coreConflict: false,
    implicitCoreTension: true,
    impulseWindow: false
  });

  assert.equal(control.engagementTier, "LIGHT");
  assert.equal(control.topicAction, "clarify");
  assert.equal(control.responsePolicy, "light_response");
});

test("conversation control degrades engagement tier when turn budget is exhausted", () => {
  const control = decideConversationControl({
    userInput: "请详细分析这个方案并给完整推导",
    recallNavigationMode: false,
    isRiskyRequest: false,
    isRefusal: false,
    coreConflict: false,
    impulseWindow: false,
    budgetContext: {
      turnBudgetMax: 10,
      turnBudgetUsed: 10,
      proactiveBudgetMax: 4,
      proactiveBudgetUsed: 1
    }
  });

  assert.equal(control.engagementTier, "NORMAL");
  assert.equal(control.budget?.degradedByBudget, true);
  assert.equal(control.budget?.budgetReasonCodes.includes("turn_budget_exhausted"), true);
  assert.equal(control.engagementPolicyVersion, "j-p1-0/v1");
});

test("conversation control keeps topic scheduler bridge metadata from topic context", () => {
  const control = decideConversationControl({
    userInput: "继续这个话题",
    recallNavigationMode: false,
    isRiskyRequest: false,
    isRefusal: false,
    coreConflict: false,
    impulseWindow: false,
    topicContext: {
      activeTopic: "Roadmap",
      candidateTopics: ["Roadmap", "音乐"],
      selectedBy: "starvation_boost",
      starvationBoostApplied: true,
      bridgeFromTopic: "音乐"
    }
  });

  assert.equal(control.topicScheduler?.activeTopic, "Roadmap");
  assert.equal(control.topicScheduler?.selectedBy, "starvation_boost");
  assert.equal(control.topicScheduler?.starvationBoostApplied, true);
  assert.equal(control.topicScheduler?.bridgeFromTopic, "音乐");
});
