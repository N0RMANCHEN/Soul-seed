import type { LifeEvent } from "./types.js";

export interface ConversationMetrics {
  assistantMessageCount: number;
  servicePhraseRate: number;
  fabricatedRecallRate: number;
  providerLeakRate: number;
}

const SERVICE_PATTERNS = [
  /(随时准备帮你处理各种事情)/u,
  /(有什么需要我做的吗)/u,
  /(为你服务)/u,
  /(你的个人助手)/u
];

const FABRICATED_RECALL_PATTERNS = [/(上次我们聊到|你之前提到过)/u];

const PROVIDER_LEAK_PATTERNS = [
  /(我是\s*deepseek)/iu,
  /(deepseek开发的ai助手)/iu,
  /(由\s*deepseek\s*开发)/iu
];

export function computeConversationMetrics(events: LifeEvent[]): ConversationMetrics {
  const assistant = events.filter((event) => event.type === "assistant_message");
  const count = assistant.length;
  if (count === 0) {
    return {
      assistantMessageCount: 0,
      servicePhraseRate: 0,
      fabricatedRecallRate: 0,
      providerLeakRate: 0
    };
  }

  let serviceHits = 0;
  let fabricatedHits = 0;
  let providerHits = 0;

  for (const event of assistant) {
    const text = String(event.payload.text ?? "");
    if (SERVICE_PATTERNS.some((p) => p.test(text))) {
      serviceHits += 1;
    }
    if (FABRICATED_RECALL_PATTERNS.some((p) => p.test(text))) {
      fabricatedHits += 1;
    }
    if (PROVIDER_LEAK_PATTERNS.some((p) => p.test(text))) {
      providerHits += 1;
    }
  }

  return {
    assistantMessageCount: count,
    servicePhraseRate: serviceHits / count,
    fabricatedRecallRate: fabricatedHits / count,
    providerLeakRate: providerHits / count
  };
}
