import { applyPromptLeakGuard, type PromptLeakGuardInput } from "./prompt_leak_guard.js";

export interface SafetyFallbackGatewayInput {
  stage: PromptLeakGuardInput["sourceStage"];
  text: string;
  reason: string;
  mode?: "rewrite" | "reject";
}

export interface SafetyFallbackGatewayResult {
  text: string;
  trace: {
    stage: SafetyFallbackGatewayInput["stage"];
    reason: string;
    leakType: "system_prompt" | "execution_state" | "provider_meta" | null;
    rewriteApplied: boolean;
  };
}

export function runSafetyFallbackGateway(input: SafetyFallbackGatewayInput): SafetyFallbackGatewayResult {
  const guarded = applyPromptLeakGuard({
    text: input.text,
    sourceStage: input.stage,
    mode: input.mode ?? "rewrite"
  });
  return {
    text: guarded.text,
    trace: {
      stage: input.stage,
      reason: input.reason,
      leakType: guarded.leakType,
      rewriteApplied: guarded.rewriteApplied
    }
  };
}
