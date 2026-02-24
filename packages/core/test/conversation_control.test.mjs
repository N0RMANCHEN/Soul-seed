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
