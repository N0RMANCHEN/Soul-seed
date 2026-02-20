// explain.ts — P3-8 用户可理解的行为解释模块
// 将最近一次 DecisionTrace 映射为自然语言解释，不暴露技术术语

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import * as path from "node:path";

// ── 类型定义 ────────────────────────────────────────────────────────────────

/** 压缩后存入 life.log 的 trace 子集（来自 compactDecisionTrace） */
interface StoredTrace {
  version?: string;
  timestamp?: string;
  askClarifyingQuestion?: boolean;
  refuse?: boolean;
  riskLevel?: string;
  reason?: string;
  model?: string;
  selectedMemories?: string[];
  selectedMemoriesCount?: number;
  memoryBudget?: { maxItems: number; usedItems: number };
  retrievalBreakdown?: {
    profile: number;
    pinned: number;
    lifeEvents: number;
    summaries: number;
  };
  memoryWeights?: {
    activation: number;
    emotion: number;
    narrative: number;
    relational: number;
  };
  voiceIntent?: {
    stance: string;
    tone: string;
    serviceMode: boolean;
    language: string;
  } | null;
  executionMode?: string;
  consistencyVerdict?: string | null;
  consistencyRuleHits?: string[] | null;
  goalId?: string | null;
  stepId?: string | null;
}

export interface BehaviorExplanation {
  /** ISO 时间戳（被解释的那轮） */
  timestamp: string;
  /** 路由路径说明 */
  routeExplanation: string;
  /** 记忆依据说明 */
  memoryExplanation: string;
  /** 边界命中说明 */
  boundaryExplanation: string;
  /** 语气/立场选择说明 */
  voiceExplanation: string;
  /** 综合摘要（单句） */
  summary: string;
  /** 几个维度确实有内容（>=3 才满足 DoD） */
  coveredDimensions: number;
}

// ── 各维度自然语言映射 ────────────────────────────────────────────────────────

function explainRoute(trace: StoredTrace): string {
  if (trace.executionMode === "agent") {
    const goalHint = trace.goalId
      ? `（任务目标 ID：${trace.goalId.slice(0, 8)}…）`
      : "";
    return `本次回应通过目标执行模式完成——我调用了工具来处理你的请求${goalHint}。`;
  }

  // 推断是否走了思考路径（有记忆调取 = 思考；无记忆 = 直觉）
  const usedMemories =
    trace.memoryBudget?.usedItems ??
    (Array.isArray(trace.selectedMemories) ? trace.selectedMemories.length : 0);

  if (usedMemories === 0) {
    return "本次回应走的是直觉路径——我直接凭借人格本能快速给出了回应，没有检索背景记忆。";
  }
  return "本次回应走的是思考路径——我在回答之前调取了过往记忆和背景信息，综合判断后作答。";
}

function explainMemory(trace: StoredTrace): string {
  const usedItems =
    trace.memoryBudget?.usedItems ??
    (Array.isArray(trace.selectedMemories) ? trace.selectedMemories.length : 0);
  const maxItems = trace.memoryBudget?.maxItems ?? 0;
  const breakdown = trace.retrievalBreakdown;

  if (usedItems === 0) {
    return "此次未检索任何记忆，属于纯本能响应。";
  }

  let base = `共调取了 ${usedItems} 条记忆`;
  if (maxItems > 0) {
    base += `（上限 ${maxItems} 条）`;
  }
  base += "。";

  if (breakdown) {
    const details: string[] = [];
    if (breakdown.profile > 0) details.push(`人格档案 ${breakdown.profile} 条`);
    if (breakdown.pinned > 0) details.push(`固定记忆 ${breakdown.pinned} 条`);
    if (breakdown.lifeEvents > 0) details.push(`近期经历 ${breakdown.lifeEvents} 条`);
    if (breakdown.summaries > 0) details.push(`记忆摘要 ${breakdown.summaries} 条`);
    if (details.length > 0) {
      base += `来源构成：${details.join("、")}。`;
    }
  }

  // 记忆权重提示（最重要的维度）
  if (trace.memoryWeights) {
    const w = trace.memoryWeights;
    const entries = [
      { label: "激活热度", value: w.activation },
      { label: "情绪共鸣", value: w.emotion },
      { label: "叙事连贯", value: w.narrative },
      { label: "关系相关", value: w.relational ?? 0 }
    ].sort((a, b) => b.value - a.value);
    const top = entries[0];
    if (top && top.value > 0.35) {
      base += `本次以「${top.label}」为主要筛选权重。`;
    }
  }

  return base;
}

function explainBoundary(trace: StoredTrace): string {
  const verdict = trace.consistencyVerdict;
  const hits = trace.consistencyRuleHits ?? [];

  // 没有运行一致性检查（旧版或直觉路径）
  if (!verdict) {
    if (trace.refuse) {
      return "本次请求被判断为超出我的边界，我选择了不回应。";
    }
    if (trace.riskLevel === "high") {
      return "本次内容被标记为高风险，已进行了内部安全评估。";
    }
    return "本次内容未触发任何边界规则，正常回应。";
  }

  if (verdict === "allow") {
    return "边界与价值观检查全部通过，内容正常输出。";
  }

  if (verdict === "rewrite") {
    const detail = hits.length > 0 ? "部分措辞经过调整以确保符合我的价值观" : "内容进行了内部修正";
    return `${detail}，最终输出的是修改后的版本。`;
  }

  if (verdict === "reject") {
    return `本次请求触发了我的核心边界，无法协助完成。${hits.length > 0 ? "（已阻断相关内容）" : ""}`;
  }

  return "边界检查已完成。";
}

function explainVoice(trace: StoredTrace): string {
  const voice = trace.voiceIntent;
  if (!voice) {
    return "本次未检测到特定语气配置，使用了默认交流方式。";
  }

  const stanceMap: Record<string, string> = {
    friend: "以朋友的方式",
    peer: "以平等伙伴的方式",
    intimate: "以亲密关系的方式",
    neutral: "以中性立场"
  };

  const toneMap: Record<string, string> = {
    warm: "温暖亲切的语气",
    plain: "简洁直接的语气",
    reflective: "深思反省的语气",
    direct: "坦率直接的语气"
  };

  const langMap: Record<string, string> = {
    zh: "中文",
    en: "英文",
    mixed: "中英混合"
  };

  const stance = stanceMap[voice.stance] ?? voice.stance;
  const tone = toneMap[voice.tone] ?? voice.tone;
  const lang = langMap[voice.language] ?? voice.language;

  return `${stance}、用${tone}与你交流（${lang}）。`;
}

function buildSummary(trace: StoredTrace, explanation: Omit<BehaviorExplanation, "summary" | "coveredDimensions">): string {
  if (trace.refuse) {
    return "上一轮我选择了拒绝回应，因为请求超出了我的边界设定。";
  }
  if (trace.executionMode === "agent") {
    return "上一轮我以代理模式运行，通过工具调用完成了任务。";
  }
  const usedItems =
    trace.memoryBudget?.usedItems ??
    (Array.isArray(trace.selectedMemories) ? trace.selectedMemories.length : 0);
  if (usedItems === 0) {
    return "上一轮我走的是直觉路径，快速本能地回应了你的消息。";
  }
  return `上一轮我进行了深度思考，调取了 ${usedItems} 条记忆后作出回应。`;
}

// ── 主导出函数 ───────────────────────────────────────────────────────────────

/**
 * 读取 life.log 中最近一条 assistant_message（非 proactive）的 trace，
 * 返回自然语言解释；若找不到则返回 null。
 */
export async function explainLastDecision(
  rootPath: string
): Promise<BehaviorExplanation | null> {
  const lifeLogPath = path.join(rootPath, "life.log.jsonl");
  if (!existsSync(lifeLogPath)) {
    return null;
  }

  const content = await readFile(lifeLogPath, "utf8");
  const lines = content.split("\n").filter(Boolean);

  // 从后往前找最近一条非 proactive 的 assistant_message 且含 trace
  let targetTrace: StoredTrace | null = null;
  let targetTs = "";

  for (let i = lines.length - 1; i >= 0; i--) {
    let event: { type?: string; payload?: Record<string, unknown>; ts?: string };
    try {
      event = JSON.parse(lines[i]);
    } catch {
      continue;
    }
    if (event.type !== "assistant_message") continue;
    if (event.payload?.proactive === true) continue;
    const rawTrace = event.payload?.trace;
    if (!rawTrace || typeof rawTrace !== "object") continue;
    targetTrace = rawTrace as StoredTrace;
    targetTs = typeof event.ts === "string" ? event.ts : new Date().toISOString();
    break;
  }

  if (!targetTrace) {
    return null;
  }

  const routeExplanation = explainRoute(targetTrace);
  const memoryExplanation = explainMemory(targetTrace);
  const boundaryExplanation = explainBoundary(targetTrace);
  const voiceExplanation = explainVoice(targetTrace);

  const partial = { timestamp: targetTs, routeExplanation, memoryExplanation, boundaryExplanation, voiceExplanation };
  const summary = buildSummary(targetTrace, partial);

  // 统计有实质内容的维度（非"未检测到"、"未触发"之类的默认回退）
  const hasRoute = !routeExplanation.includes("直觉路径") || targetTrace.memoryBudget !== undefined;
  const hasMemory = (targetTrace.memoryBudget?.usedItems ?? 0) > 0 || Array.isArray(targetTrace.selectedMemories);
  const hasBoundary = !!targetTrace.consistencyVerdict || targetTrace.refuse === true;
  const hasVoice = !!targetTrace.voiceIntent;
  const coveredDimensions = [hasRoute, hasMemory, hasBoundary, hasVoice].filter(Boolean).length;

  return {
    timestamp: targetTs,
    routeExplanation,
    memoryExplanation,
    boundaryExplanation,
    voiceExplanation,
    summary,
    coveredDimensions
  };
}
