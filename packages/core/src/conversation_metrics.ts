import type { LifeEvent } from "./types.js";

export interface ConversationMetrics {
  assistantMessageCount: number;
  servicePhraseRate: number;
  fabricatedRecallRate: number;
  providerLeakRate: number;
  l1HitRate: number;
  l2HitRate: number;
  l3ArbitrationRate: number;
  l4RegexFallbackRate: number;
  businessPathRegexRate: number;
  promptLeakBlockedRate: number;
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
      providerLeakRate: 0,
      l1HitRate: 0,
      l2HitRate: 0,
      l3ArbitrationRate: 0,
      l4RegexFallbackRate: 0,
      businessPathRegexRate: 0,
      promptLeakBlockedRate: 0
    };
  }

  let serviceHits = 0;
  let fabricatedHits = 0;
  let providerHits = 0;
  let routingCount = 0;
  let l1Hits = 0;
  let l2Hits = 0;
  let l3Hits = 0;
  let l4Hits = 0;
  let businessRegexHits = 0;
  let promptLeakHits = 0;

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
    const routing = (event.payload.trace as { routing?: { tier?: string; isBusinessPath?: boolean } } | undefined)?.routing;
    if (routing && typeof routing.tier === "string") {
      routingCount += 1;
      if (routing.tier === "L1") l1Hits += 1;
      if (routing.tier === "L2") l2Hits += 1;
      if (routing.tier === "L3") l3Hits += 1;
      if (routing.tier === "L4") {
        l4Hits += 1;
        if (routing.isBusinessPath !== false) {
          businessRegexHits += 1;
        }
      }
    }
    const promptLeakGuard = event.payload.promptLeakGuard as { leak_type?: string } | undefined;
    if (promptLeakGuard?.leak_type) {
      promptLeakHits += 1;
    }
  }

  return {
    assistantMessageCount: count,
    servicePhraseRate: serviceHits / count,
    fabricatedRecallRate: fabricatedHits / count,
    providerLeakRate: providerHits / count,
    l1HitRate: routingCount > 0 ? l1Hits / routingCount : 0,
    l2HitRate: routingCount > 0 ? l2Hits / routingCount : 0,
    l3ArbitrationRate: routingCount > 0 ? l3Hits / routingCount : 0,
    l4RegexFallbackRate: routingCount > 0 ? l4Hits / routingCount : 0,
    businessPathRegexRate: routingCount > 0 ? businessRegexHits / routingCount : 0,
    promptLeakBlockedRate: promptLeakHits / count
  };
}
