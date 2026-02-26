export interface PromptLeakGuardInput {
  text: string;
  sourceStage:
    | "greeting"
    | "proactive"
    | "farewell"
    | "exit_confirm"
    | "reply"
    | "tool_preflight"
    | "tool_result"
    | "tool_failure";
  mode?: "rewrite" | "reject";
}

export interface PromptLeakGuardResult {
  text: string;
  blocked: boolean;
  leakType: "system_prompt" | "execution_state" | "provider_meta" | null;
  sourceStage: PromptLeakGuardInput["sourceStage"];
  rewriteApplied: boolean;
}

const LEAK_PATTERNS: Array<{ type: NonNullable<PromptLeakGuardResult["leakType"]>; pattern: RegExp }> = [
  { type: "system_prompt", pattern: /(系统提示|system prompt|内核提示|hidden instruction)/iu },
  { type: "execution_state", pattern: /(执行状态|chain of thought|内部推理|internal state)/iu },
  { type: "provider_meta", pattern: /(adapter|provider|endpoint|model[_ -]?not[_ -]?exist)/iu }
];

export function applyPromptLeakGuard(input: PromptLeakGuardInput): PromptLeakGuardResult {
  const raw = String(input.text ?? "");
  const mode = input.mode ?? "rewrite";
  const hit = LEAK_PATTERNS.find((item) => item.pattern.test(raw));
  if (!hit) {
    return {
      text: raw,
      blocked: false,
      leakType: null,
      sourceStage: input.sourceStage,
      rewriteApplied: false
    };
  }
  if (mode === "reject") {
    return {
      text: "这部分我不直接展开。我换个自然方式继续。",
      blocked: true,
      leakType: hit.type,
      sourceStage: input.sourceStage,
      rewriteApplied: false
    };
  }
  let rewritten = raw;
  for (const pattern of LEAK_PATTERNS) {
    rewritten = rewritten.replace(pattern.pattern, "");
  }
  rewritten = rewritten.replace(/\s{2,}/g, " ").trim();
  if (!rewritten) {
    rewritten = "我们继续说你关心的内容。";
  }
  return {
    text: rewritten,
    blocked: false,
    leakType: hit.type,
    sourceStage: input.sourceStage,
    rewriteApplied: true
  };
}
