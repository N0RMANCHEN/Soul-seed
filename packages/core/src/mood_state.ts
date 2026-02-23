/**
 * P2-0: 内在情绪状态模型
 * 独立于关系维度，描述 persona 在当前时刻的情绪状态。
 * 随对话自动演化，并向基线（valence=0.5, arousal=0.3）衰减。
 * EB-1: 增加 moodLatent（32维）为真实内在情绪状态；valence/arousal/dominantEmotion 为投影层。
 * valence 使用 [0, 1]，baseline=0.5（中性）。
 */
import { writeFile, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import type { DominantEmotion, MoodState } from "./types.js";

export const MOOD_STATE_FILENAME = "mood_state.json";
export const MOOD_LATENT_HISTORY_FILENAME = "mood_latent_history.jsonl";
export const MOOD_LATENT_DIM = 32;

const BASELINE_VALENCE = 0.5;
const BASELINE_AROUSAL = 0.3;

// ─── EB-1: Mood Latent 向量操作 ──────────────────────────────────────────────

/**
 * 创建 32 维基线 latent 向量
 * dim[0] = valence baseline (0.5 = neutral), dim[1] = arousal baseline (0.3), rest = 0.0
 */
export function createMoodLatentBaseline(): number[] {
  const z = new Array(MOOD_LATENT_DIM).fill(0.0) as number[];
  z[0] = BASELINE_VALENCE;
  z[1] = BASELINE_AROUSAL;
  return z;
}

/**
 * 从 latent 向量投影出 valence/arousal/dominantEmotion（向后兼容接口）
 * 使用 dim[0] 和 dim[1] 作为主要投影轴
 */
export function projectMoodLatent(z: number[]): { valence: number; arousal: number; dominantEmotion: DominantEmotion } {
  const valence = clamp(z[0] ?? BASELINE_VALENCE, 0, 1);
  const arousal = clamp(z[1] ?? BASELINE_AROUSAL, 0, 1);
  return { valence, arousal, dominantEmotion: inferDominantEmotion(valence, arousal) };
}

/**
 * 小步长更新 latent 向量（防止大步漂移）
 * z ← normalize((1-α)·z + α·(z + Δz))
 */
export function updateMoodLatent(
  currentLatent: number[],
  deltaV: number,
  deltaA: number,
  alpha = 0.15
): number[] {
  const z = [...currentLatent];
  const newZ0 = clamp(z[0] + deltaV, 0, 1);
  const newZ1 = clamp(z[1] + deltaA, 0, 1);
  // Small step via lerp: z ← (1-α)*z + α*(z + Δz)
  z[0] = clamp((1 - alpha) * (z[0] ?? BASELINE_VALENCE) + alpha * newZ0, 0, 1);
  z[1] = clamp((1 - alpha) * (z[1] ?? BASELINE_AROUSAL) + alpha * newZ1, 0, 1);
  return z;
}

/**
 * EB-1: 保存 latent 快照到 jsonl 历史文件
 */
export async function saveMoodLatentSnapshot(rootPath: string, z: number[]): Promise<void> {
  const record = JSON.stringify({ ts: new Date().toISOString(), z }) + "\n";
  const p = path.join(rootPath, MOOD_LATENT_HISTORY_FILENAME);
  await writeFile(p, record, { flag: "a", encoding: "utf8" });
}

/**
 * 验证 latent 向量是否合法（32个数字）
 */
export function isMoodLatentValid(z: unknown): z is number[] {
  return Array.isArray(z) && z.length === MOOD_LATENT_DIM && z.every(v => typeof v === "number" && isFinite(v));
}

export function createInitialMoodState(createdAt?: string): MoodState {
  const moodLatent = createMoodLatentBaseline();
  return {
    moodLatent,
    valence: BASELINE_VALENCE,
    arousal: BASELINE_AROUSAL,
    dominantEmotion: "calm",
    triggers: [],
    onMindSnippet: null,
    decayRate: 0.08,
    updatedAt: createdAt ?? new Date().toISOString()
  };
}

export function normalizeMoodState(raw: Record<string, unknown>): MoodState {
  // EB-1: Load moodLatent if present; derive valence/arousal from it for backward compat
  let moodLatent: number[] | undefined;
  if (Array.isArray(raw.moodLatent) && raw.moodLatent.length === MOOD_LATENT_DIM) {
    moodLatent = raw.moodLatent.map(v => (typeof v === "number" && isFinite(v) ? v : 0));
  }

  // If latent present, project to scalar coords; otherwise fall back to stored scalars
  let valence: number;
  let arousal: number;
  if (moodLatent) {
    const projected = projectMoodLatent(moodLatent);
    valence = projected.valence;
    arousal = projected.arousal;
  } else {
    valence = clamp(typeof raw.valence === "number" ? raw.valence : BASELINE_VALENCE, 0, 1);
    arousal = clamp(typeof raw.arousal === "number" ? raw.arousal : BASELINE_AROUSAL, 0, 1);
  }
  const dominantEmotion = isValidEmotion(raw.dominantEmotion) ? raw.dominantEmotion : inferDominantEmotion(valence, arousal);
  const triggers = Array.isArray(raw.triggers)
    ? raw.triggers.filter((t): t is string => typeof t === "string").slice(0, 3)
    : [];
  const onMindSnippet =
    typeof raw.onMindSnippet === "string" ? raw.onMindSnippet.slice(0, 60) : null;
  const decayRate =
    typeof raw.decayRate === "number" && raw.decayRate > 0 ? raw.decayRate : 0.08;
  const updatedAt =
    typeof raw.updatedAt === "string" ? raw.updatedAt : new Date().toISOString();
  return { moodLatent, valence, arousal, dominantEmotion, triggers, onMindSnippet, decayRate, updatedAt };
}

export async function loadMoodState(rootPath: string): Promise<MoodState | null> {
  const p = path.join(rootPath, MOOD_STATE_FILENAME);
  if (!existsSync(p)) return null;
  try {
    const raw = JSON.parse(await readFile(p, "utf8")) as Record<string, unknown>;
    return normalizeMoodState(raw);
  } catch {
    return null;
  }
}

export async function writeMoodState(rootPath: string, state: MoodState): Promise<void> {
  const p = path.join(rootPath, MOOD_STATE_FILENAME);
  await writeFile(p, JSON.stringify(state, null, 2), "utf8");
}

/**
 * 基于时间向基线衰减情绪（不写盘，只返回新状态）
 */
export function decayMoodTowardBaseline(state: MoodState): MoodState {
  const now = Date.now();
  const last = new Date(state.updatedAt).getTime();
  const hoursElapsed = (now - last) / 3_600_000;
  if (hoursElapsed < 0.01) return state; // < 36 秒，不衰减

  const decayFactor = Math.exp(-state.decayRate * hoursElapsed);

  // EB-1: Decay latent vector if present
  let moodLatent = state.moodLatent;
  if (moodLatent) {
    // Sync dims [0] and [1] from scalar state (backward compat: caller may set valence/arousal directly)
    const synced = [...moodLatent];
    synced[0] = state.valence;
    synced[1] = state.arousal;

    const baseline = createMoodLatentBaseline();
    moodLatent = synced.map((v, i) => {
      const base = baseline[i] ?? 0;
      return clampDim(base + (v - base) * decayFactor, i);
    });
    const projected = projectMoodLatent(moodLatent);
    return {
      ...state,
      moodLatent,
      valence: projected.valence,
      arousal: projected.arousal,
      dominantEmotion: projected.dominantEmotion
    };
  }

  // Fallback: scalar-only decay
  const valence = BASELINE_VALENCE + (state.valence - BASELINE_VALENCE) * decayFactor;
  const arousal = BASELINE_AROUSAL + (state.arousal - BASELINE_AROUSAL) * decayFactor;
  return {
    ...state,
    valence: clamp(valence, 0, 1),
    arousal: clamp(arousal, 0, 1),
    dominantEmotion: inferDominantEmotion(valence, arousal)
  };
}

/**
 * 根据一轮对话中的用户输入 + 助手输出更新情绪状态（写盘）
 */
export async function evolveMoodStateFromTurn(
  rootPath: string,
  params: {
    userInput: string;
    assistantOutput: string;
    triggerHash?: string;
  }
): Promise<MoodState> {
  const current = (await loadMoodState(rootPath)) ?? createInitialMoodState();
  const decayed = decayMoodTowardBaseline(current);
  const next = computeMoodDelta(decayed, params.userInput, params.assistantOutput);
  if (params.triggerHash) {
    next.triggers = [params.triggerHash, ...next.triggers].slice(0, 3);
  }
  next.dominantEmotion = inferDominantEmotion(next.valence, next.arousal);
  next.updatedAt = new Date().toISOString();
  await writeMoodState(rootPath, next);
  return next;
}

// ─── private helpers ──────────────────────────────────────────────────────────

function computeMoodDelta(
  state: MoodState,
  userInput: string,
  assistantOutput: string
): MoodState {
  const userText = userInput.trim();
  const assistText = assistantOutput.trim();

  let deltaV = 0;
  let deltaA = 0;

  // 用户正向情绪信号
  if (/谢谢|感谢|喜欢|开心|好棒|你真的很好|appreciate|thanks|love it|happy|great/i.test(userText)) {
    deltaV += 0.06; deltaA += 0.03;
  }
  // 用户负向情绪信号
  if (/讨厌|烦死了|失望|差劲|hate|disappointed|frustrated|annoying|stupid/i.test(userText)) {
    deltaV -= 0.07; deltaA += 0.05;
  }
  // 用户亲密信号
  if (/爱你|想你|亲亲|宝贝|love you|miss you|darling|dear/i.test(userText)) {
    deltaV += 0.05; deltaA += 0.04;
  }
  // 用户好奇/探索信号
  if (/为什么|怎么|是不是|真的吗|告诉我|why|how|tell me|curious|wonder/i.test(userText)) {
    deltaA += 0.04;
  }
  // 用户疲惫/平静信号
  if (/累了|好累|困了|睡觉|晚安|tired|sleepy|goodnight|need rest/i.test(userText)) {
    deltaV += 0.02; deltaA -= 0.05;
  }
  // 助手输出情绪反射
  if (/[emotion:warm]|[emotion:tender]|温柔|感动|touched/i.test(assistText)) {
    deltaV += 0.03; deltaA += 0.01;
  }
  if (/[emotion:playful]|[emotion:giddy]|开玩笑|笑死|haha/i.test(assistText)) {
    deltaV += 0.04; deltaA += 0.04;
  }
  if (/[emotion:sad]|[emotion:melancholic]|难过|伤心|sad|melancholic/i.test(assistText)) {
    deltaV -= 0.03;
  }
  if (/[emotion:curious]|有趣|想了解|curious|interesting/i.test(assistText)) {
    deltaA += 0.03;
  }

  // EB-1: Update latent vector if present (small-step update)
  if (state.moodLatent) {
    const newLatent = updateMoodLatent(state.moodLatent, deltaV, deltaA);
    const projected = projectMoodLatent(newLatent);
    return { ...state, moodLatent: newLatent, valence: projected.valence, arousal: projected.arousal };
  }

  // Fallback: scalar-only update
  return {
    ...state,
    valence: clamp(state.valence + deltaV, 0, 1),
    arousal: clamp(state.arousal + deltaA, 0, 1)
  };
}

// Thresholds for valence ∈ [0, 1], baseline = 0.5
export function inferDominantEmotion(valence: number, arousal: number): DominantEmotion {
  if (valence >= 0.75 && arousal >= 0.6) return "playful";
  if (valence >= 0.65 && arousal >= 0.3) return "warm";
  if (valence >= 0.55 && arousal < 0.3) return "tender";
  if (valence <= 0.2 && arousal >= 0.55) return "guarded";
  if (valence <= 0.3 && arousal < 0.35) return "melancholic";
  if (arousal >= 0.65) return "restless";
  if (arousal >= 0.5) return "curious";
  return "calm";
}

function isValidEmotion(v: unknown): v is DominantEmotion {
  return (
    v === "calm" ||
    v === "curious" ||
    v === "playful" ||
    v === "melancholic" ||
    v === "tender" ||
    v === "restless" ||
    v === "warm" ||
    v === "guarded"
  );
}

export function isMoodStateValid(raw: Record<string, unknown>): boolean {
  return (
    typeof raw.valence === "number" &&
    typeof raw.arousal === "number" &&
    isValidEmotion(raw.dominantEmotion) &&
    Array.isArray(raw.triggers) &&
    typeof raw.decayRate === "number" &&
    typeof raw.updatedAt === "string"
  );
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

/** EB-1: Clamp latent dimension based on index (dim[0]=valence→[0,1], rest→[0,1]) */
function clampDim(val: number, dimIndex: number): number {
  return dimIndex === 0 ? clamp(val, 0, 1) : clamp(val, 0, 1);
}
