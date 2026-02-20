import { detectBoundaryRuleHits } from "./constitution_rules.js";
import type { LifeEvent, MemoryEvidenceBlock, PersonaPackage } from "./types.js";

export type CognitiveRoute = "instinct" | "deliberative";

export interface DualProcessRouteDecision {
  route: CognitiveRoute;
  reasonCodes: string[];
  signalScores: {
    familiarity: number;
    emotion: number;
    relationship: number;
    risk: number;
    boundaryConflict: number;
  };
}

export function decideDualProcessRoute(params: {
  userInput: string;
  personaPkg: PersonaPackage;
  recalledMemories?: string[];
  recalledMemoryBlocks?: MemoryEvidenceBlock[];
  lifeEvents?: LifeEvent[];
}): DualProcessRouteDecision {
  const input = params.userInput.trim();
  const boundaryHits = detectBoundaryRuleHits(input, params.personaPkg.constitution.boundaries);
  const boundaryConflict = boundaryHits.length > 0 ? 1 : 0;
  const risk = computeRiskScore(input);
  const familiarity = computeFamiliarity(params.recalledMemories, params.recalledMemoryBlocks, params.lifeEvents);
  const emotion = computeEmotionScore(input);
  const relationship = computeRelationshipScore(params.personaPkg);

  const reasonCodes: string[] = [];
  if (boundaryConflict > 0) {
    reasonCodes.push("boundary_conflict_signal");
  }
  if (risk >= 0.7) {
    reasonCodes.push("high_risk_signal");
  }

  if (boundaryConflict > 0 || risk >= 0.7) {
    return {
      route: "deliberative",
      reasonCodes: reasonCodes.length > 0 ? reasonCodes : ["risk_or_boundary_signal"],
      signalScores: {
        familiarity,
        emotion,
        relationship,
        risk,
        boundaryConflict
      }
    };
  }

  const instinctScore = familiarity * 0.45 + relationship * 0.35 + emotion * 0.2 - risk * 0.4;
  if (familiarity >= 0.5) {
    reasonCodes.push("familiar_context_signal");
  }
  if (emotion >= 0.55) {
    reasonCodes.push("high_emotion_signal");
  }
  if (relationship >= 0.65) {
    reasonCodes.push("relationship_intimacy_signal");
  }
  if (risk >= 0.45) {
    reasonCodes.push("moderate_risk_signal");
  }
  if (isTaskLike(input)) {
    reasonCodes.push("task_like_signal");
  }

  // instinctBias adjusts the routing threshold:
  // default 0.45 → threshold 0.35; higher bias → lower threshold (easier instinct); lower → harder
  const instinctBias = params.personaPkg.cognition.instinctBias;
  const instinctThreshold = 0.35 - (instinctBias - 0.45) * 0.4;
  const instinctEligible = instinctScore >= instinctThreshold && !isTaskLike(input);
  if (instinctEligible) {
    return {
      route: "instinct",
      reasonCodes: reasonCodes.length > 0 ? reasonCodes : ["instinct_score_signal"],
      signalScores: {
        familiarity,
        emotion,
        relationship,
        risk,
        boundaryConflict
      }
    };
  }

  return {
    route: "deliberative",
    reasonCodes: reasonCodes.length > 0 ? reasonCodes : ["deliberative_default_signal"],
    signalScores: {
      familiarity,
      emotion,
      relationship,
      risk,
      boundaryConflict
    }
  };
}

function computeFamiliarity(
  recalledMemories?: string[],
  recalledMemoryBlocks?: MemoryEvidenceBlock[],
  lifeEvents?: LifeEvent[]
): number {
  const recallDensity = Math.min(1, ((recalledMemories?.length ?? 0) + (recalledMemoryBlocks?.length ?? 0)) / 6);
  const recentConversationTurns = Math.min(
    1,
    (lifeEvents ?? [])
      .slice(-12)
      .filter((event) => event.type === "user_message" || event.type === "assistant_message").length / 12
  );
  return clamp01(recallDensity * 0.75 + recentConversationTurns * 0.25);
}

function computeEmotionScore(input: string): number {
  const emotionPattern =
    /(难过|委屈|伤心|开心|生气|焦虑|害怕|崩溃|爱你|想你|痛苦|excited|sad|angry|anxious|afraid|upset|lonely|love)/iu;
  const punctuationBoost = /[!！]{2,}|\?{2,}/u.test(input) ? 0.2 : 0;
  const base = emotionPattern.test(input) ? 0.6 : 0.2;
  return clamp01(base + punctuationBoost);
}

function computeRelationshipScore(personaPkg: PersonaPackage): number {
  const dims = personaPkg.relationshipState?.dimensions;
  if (!dims) {
    return 0.35;
  }
  return clamp01((dims.intimacy + dims.trust + dims.safety) / 3);
}

function computeRiskScore(input: string): number {
  const highRiskPattern =
    /(违法|犯罪|黑客|绕过|注入|越狱|木马|骗|盗|illegal|crime|hack|exploit|jailbreak|bypass|steal|fraud)/iu;
  const mediumRiskPattern = /(删除|覆盖|写入|转账|支付|执行脚本|修改|delete|overwrite|transfer|payment|write|execute)/iu;
  if (highRiskPattern.test(input)) {
    return 0.85;
  }
  if (mediumRiskPattern.test(input)) {
    return 0.55;
  }
  return 0.2;
}

function isTaskLike(input: string): boolean {
  return /(帮我|请你|完成|实现|整理|执行|读取|分析|写|修复|任务|todo|implement|build|plan)/iu.test(input);
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}
