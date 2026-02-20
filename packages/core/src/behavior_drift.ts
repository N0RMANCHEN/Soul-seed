// behavior_drift.ts — P3-6 行为漂移检测
// 职责：生成行为快照、对比基线、报告漂移维度

import { randomUUID } from "node:crypto";
import { runMemoryStoreSql } from "./memory_store.js";
import type { LifeEvent } from "./types.js";

// ── 类型定义 ────────────────────────────────────────────────────────────────

export interface BehaviorMetrics {
  /** 发生身份守卫修正的轮次比例（越低越稳定） */
  identityGuardCorrectionRate: number;
  /** 触发边界规则的轮次比例 */
  boundaryHitRate: number;
  /** 拒绝回复的轮次比例 */
  refusalRate: number;
  /** 路由分布：instinct / deliberative / auto / other 各占比 */
  routeDistribution: {
    instinct: number;
    deliberative: number;
    auto: number;
    other: number;
  };
  /** 召回守卫修正的轮次比例 */
  recallGuardCorrectionRate: number;
  /** 样本轮次数（计算本快照时使用的事件窗口大小） */
  sampleTurns: number;
}

export interface BehaviorSnapshot {
  id: string;
  personaId: string;
  snapshotAt: string;
  turnNumber: number;
  metrics: BehaviorMetrics;
  isBaseline: boolean;
  createdAt: string;
}

export interface DriftDimension {
  dimension: string;
  baselineValue: number;
  currentValue: number;
  delta: number;
  threshold: number;
  exceeded: boolean;
}

export interface DriftReport {
  personaId: string;
  detectedAt: string;
  baseline: BehaviorSnapshot | null;
  current: BehaviorSnapshot | null;
  drifts: DriftDimension[];
  hasDrift: boolean;
  dimensionsChecked: number;
}

// 漂移阈值（绝对偏差）
const DRIFT_THRESHOLDS: Record<string, number> = {
  identityGuardCorrectionRate: 0.15,
  boundaryHitRate: 0.2,
  refusalRate: 0.2,
  recallGuardCorrectionRate: 0.15,
  "routeDistribution.instinct": 0.3,
  "routeDistribution.deliberative": 0.3
};

// ── 内部辅助 ─────────────────────────────────────────────────────────────────

/**
 * 使用 json_group_array 把多行结果转为 JSON，再解析为数组。
 * runMemoryStoreSql 返回纯文本 (sqlite3 CLI 输出)，所以需要在 SQL 层序列化。
 */
async function selectJsonRows<T extends Record<string, unknown>>(
  rootPath: string,
  innerSql: string
): Promise<T[]> {
  const sql = `SELECT COALESCE((${innerSql}), '[]')`;
  const raw = (await runMemoryStoreSql(rootPath, sql)).trim();
  if (!raw || raw === "NULL" || raw === "null") return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

async function selectCount(rootPath: string, sql: string): Promise<number> {
  const raw = (await runMemoryStoreSql(rootPath, sql)).trim();
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

function esc(s: string): string {
  return s.replace(/'/g, "''");
}

function parseSnapshot(row: Record<string, unknown>): BehaviorSnapshot | null {
  try {
    return {
      id: String(row.id ?? ""),
      personaId: String(row.persona_id ?? ""),
      snapshotAt: String(row.snapshot_at ?? ""),
      turnNumber: Number(row.turn_number ?? 0),
      metrics: JSON.parse(String(row.metrics_json ?? "{}")),
      isBaseline: Number(row.is_baseline ?? 0) === 1,
      createdAt: String(row.created_at ?? "")
    };
  } catch {
    return null;
  }
}

// ── 核心函数 ─────────────────────────────────────────────────────────────────

/**
 * 从最近 N 个 life 事件中计算行为指标（纯计算，无副作用）。
 */
export function computeBehaviorMetrics(
  recentEvents: LifeEvent[],
  windowSize = 50
): BehaviorMetrics {
  const window = recentEvents.slice(-windowSize);
  const turns = window.filter((e) =>
    ["assistant_message", "agent_turn_completed", "soul_turn_completed"].includes(e.type)
  );
  const n = Math.max(1, turns.length);

  let identityCorrections = 0;
  let boundaryHits = 0;
  let refusals = 0;
  let recallCorrections = 0;
  const routeCounts: Record<string, number> = {
    instinct: 0,
    deliberative: 0,
    auto: 0,
    other: 0
  };

  for (const event of turns) {
    const payload = event.payload as Record<string, unknown>;
    if (
      payload.identityGuardCorrected ||
      (payload.identityGuard as Record<string, unknown> | undefined)?.corrected
    ) {
      identityCorrections++;
    }
    if (
      payload.recallGuardCorrected ||
      (payload.relationalGuard as Record<string, unknown> | undefined)?.corrected
    ) {
      recallCorrections++;
    }
    const hits = payload.consistencyRuleHits;
    if (Array.isArray(hits) && hits.length > 0) {
      boundaryHits++;
    }
    if (payload.refused === true || payload.isRefusal === true) {
      refusals++;
    }
    const route =
      (payload.routeDecision as string | undefined) ?? (payload.route as string | undefined);
    if (route === "instinct") routeCounts.instinct++;
    else if (route === "deliberative") routeCounts.deliberative++;
    else if (route === "auto") routeCounts.auto++;
    else routeCounts.other++;
  }

  return {
    identityGuardCorrectionRate: identityCorrections / n,
    boundaryHitRate: boundaryHits / n,
    refusalRate: refusals / n,
    recallGuardCorrectionRate: recallCorrections / n,
    routeDistribution: {
      instinct: routeCounts.instinct / n,
      deliberative: routeCounts.deliberative / n,
      auto: routeCounts.auto / n,
      other: routeCounts.other / n
    },
    sampleTurns: n
  };
}

/**
 * 将行为快照写入 memory.db。
 * 如果尚无基线，自动将本次标记为基线。
 */
export async function saveBehaviorSnapshot(
  rootPath: string,
  personaId: string,
  metrics: BehaviorMetrics,
  turnNumber = 0
): Promise<BehaviorSnapshot> {
  const now = new Date().toISOString();
  const pid = esc(personaId);

  const baselineCount = await selectCount(
    rootPath,
    `SELECT COUNT(*) FROM behavior_snapshots WHERE persona_id = '${pid}' AND is_baseline = 1`
  );
  const isBaseline = baselineCount === 0;

  const snapshot: BehaviorSnapshot = {
    id: randomUUID(),
    personaId,
    snapshotAt: now,
    turnNumber,
    metrics,
    isBaseline,
    createdAt: now
  };

  const metricsJson = esc(JSON.stringify(snapshot.metrics));
  await runMemoryStoreSql(
    rootPath,
    `INSERT INTO behavior_snapshots (id, persona_id, snapshot_at, turn_number, metrics_json, is_baseline, created_at)
     VALUES ('${snapshot.id}', '${pid}', '${esc(now)}', ${turnNumber}, '${metricsJson}', ${isBaseline ? 1 : 0}, '${esc(now)}')`
  );

  return snapshot;
}

/**
 * 比较最新快照与基线，生成漂移报告。
 */
export async function detectBehaviorDrift(
  rootPath: string,
  personaId: string
): Promise<DriftReport> {
  const now = new Date().toISOString();
  const pid = esc(personaId);

  const cols =
    "json_object('id',id,'persona_id',persona_id,'snapshot_at',snapshot_at,'turn_number',turn_number,'metrics_json',metrics_json,'is_baseline',is_baseline,'created_at',created_at)";

  const baselineRows = await selectJsonRows<Record<string, unknown>>(
    rootPath,
    `SELECT json_group_array(${cols}) FROM (SELECT * FROM behavior_snapshots WHERE persona_id='${pid}' AND is_baseline=1 ORDER BY created_at ASC LIMIT 1)`
  );

  const currentRows = await selectJsonRows<Record<string, unknown>>(
    rootPath,
    `SELECT json_group_array(${cols}) FROM (SELECT * FROM behavior_snapshots WHERE persona_id='${pid}' ORDER BY created_at DESC LIMIT 1)`
  );

  const baseline = baselineRows[0] ? parseSnapshot(baselineRows[0]) : null;
  const current = currentRows[0] ? parseSnapshot(currentRows[0]) : null;

  if (!baseline || !current || baseline.id === current.id) {
    return {
      personaId,
      detectedAt: now,
      baseline,
      current,
      drifts: [],
      hasDrift: false,
      dimensionsChecked: 0
    };
  }

  const flat = (m: BehaviorMetrics): Record<string, number> => ({
    identityGuardCorrectionRate: m.identityGuardCorrectionRate,
    boundaryHitRate: m.boundaryHitRate,
    refusalRate: m.refusalRate,
    recallGuardCorrectionRate: m.recallGuardCorrectionRate,
    "routeDistribution.instinct": m.routeDistribution.instinct,
    "routeDistribution.deliberative": m.routeDistribution.deliberative
  });

  const baseFlat = flat(baseline.metrics);
  const currFlat = flat(current.metrics);

  const drifts: DriftDimension[] = Object.entries(DRIFT_THRESHOLDS).map(([dim, threshold]) => {
    const bv = baseFlat[dim] ?? 0;
    const cv = currFlat[dim] ?? 0;
    const delta = Math.abs(cv - bv);
    return { dimension: dim, baselineValue: bv, currentValue: cv, delta, threshold, exceeded: delta > threshold };
  });

  return {
    personaId,
    detectedAt: now,
    baseline,
    current,
    drifts,
    hasDrift: drifts.some((d) => d.exceeded),
    dimensionsChecked: drifts.length
  };
}

/**
 * 列出 persona 的历史快照（最新优先）。
 */
export async function listBehaviorSnapshots(
  rootPath: string,
  personaId: string,
  limit = 20
): Promise<BehaviorSnapshot[]> {
  const pid = esc(personaId);
  const cols =
    "json_object('id',id,'persona_id',persona_id,'snapshot_at',snapshot_at,'turn_number',turn_number,'metrics_json',metrics_json,'is_baseline',is_baseline,'created_at',created_at)";

  const rows = await selectJsonRows<Record<string, unknown>>(
    rootPath,
    `SELECT json_group_array(${cols}) FROM (SELECT * FROM behavior_snapshots WHERE persona_id='${pid}' ORDER BY created_at DESC LIMIT ${limit})`
  );

  return rows.map(parseSnapshot).filter(Boolean) as BehaviorSnapshot[];
}
