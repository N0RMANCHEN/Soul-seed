import { randomUUID } from "node:crypto";
import type {
  CapabilityCallRequest,
  MetaActionArbitration,
  MetaActionDraft,
  MetaIntentPlan,
  PersonaJudgmentLabel
} from "./types.js";

export function planMetaIntent(params: {
  userInput: string;
  capabilityCandidate?: CapabilityCallRequest;
  refusal?: boolean;
}): MetaIntentPlan {
  if (params.refusal) {
    return {
      domain: "dialogue",
      intent: "refuse",
      rationale: "safety_or_core_conflict"
    };
  }
  if (params.capabilityCandidate) {
    return {
      domain: "tool",
      intent: "tool_call",
      rationale: "capability_candidate_detected"
    };
  }
  if (params.userInput.trim().length <= 1) {
    return {
      domain: "dialogue",
      intent: "ask_clarify",
      rationale: "input_too_short"
    };
  }
  return {
    domain: "dialogue",
    intent: "reply",
    rationale: "default_dialogue_reply"
  };
}

export function composeMetaAction(params: {
  plan: MetaIntentPlan;
  replyDraft?: string;
  toolDraft?: CapabilityCallRequest;
  memoryJudgmentDraft?: MetaActionDraft["memoryJudgmentDraft"];
}): MetaActionDraft {
  if (params.plan.domain === "tool") {
    return {
      toolDraft: params.toolDraft,
      memoryJudgmentDraft: params.memoryJudgmentDraft
    };
  }
  return {
    replyDraft: params.replyDraft?.trim(),
    memoryJudgmentDraft: params.memoryJudgmentDraft
  };
}

export function arbitrateMetaAction(params: {
  plan: MetaIntentPlan;
  draft: MetaActionDraft;
  advisory?: {
    toolFeasible?: boolean;
    replyFallback?: string;
  };
  mode: "off" | "shadow" | "active";
}): MetaActionArbitration {
  const traceId = randomUUID();
  if (params.mode === "off") {
    return {
      traceId,
      finalReply: params.draft.replyDraft,
      finalToolCall: params.draft.toolDraft,
      summary: "meta_disabled",
      applied: false
    };
  }
  if (params.plan.domain === "tool") {
    const feasible = params.advisory?.toolFeasible !== false;
    return {
      traceId,
      finalToolCall: feasible ? params.draft.toolDraft : undefined,
      summary: feasible ? "tool_domain_function_priority_allow" : "tool_domain_function_priority_block",
      applied: params.mode === "active"
    };
  }
  const reply = params.draft.replyDraft?.trim() || params.advisory?.replyFallback || "";
  return {
    traceId,
    finalReply: reply,
    summary: "dialogue_domain_persona_priority",
    applied: params.mode === "active"
  };
}

export function judgePersonaContentLabel(params: {
  userInput: string;
  sourceUri?: string;
  sourceKind?: "file" | "web";
  systemAdvice?: PersonaJudgmentLabel;
}): { label: PersonaJudgmentLabel; confidence: number; rationale: string; evidenceRefs: string[] } {
  const content = params.userInput.trim();
  const refs: string[] = [];
  if (params.sourceUri) {
    refs.push(params.sourceUri);
  }
  const fictionPattern = /小说|剧情|人物|章节|番外|主角|chapter|novel|fiction/u;
  const nonFictionPattern = /论文|研究|报道|数据|资料|来源|report|research|paper|data/u;
  const fiction = fictionPattern.test(content);
  const nonFiction = nonFictionPattern.test(content);
  if (fiction && nonFiction) {
    return {
      label: "mixed",
      confidence: 0.7,
      rationale: "both_fiction_and_non_fiction_signals",
      evidenceRefs: refs
    };
  }
  if (fiction) {
    return {
      label: "fiction",
      confidence: 0.78,
      rationale: "fiction_signals_detected",
      evidenceRefs: refs
    };
  }
  if (nonFiction) {
    return {
      label: "non_fiction",
      confidence: 0.76,
      rationale: "non_fiction_signals_detected",
      evidenceRefs: refs
    };
  }
  if (params.systemAdvice && params.systemAdvice !== "uncertain") {
    return {
      label: params.systemAdvice,
      confidence: 0.55,
      rationale: "fallback_to_system_advice",
      evidenceRefs: refs
    };
  }
  return {
    label: "uncertain",
    confidence: 0.45,
    rationale: "insufficient_label_signals",
    evidenceRefs: refs
  };
}
