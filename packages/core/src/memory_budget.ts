import { ensureMemoryStore, runMemoryStoreSql } from "./memory_store.js";
import { getRecallQueryCacheStats, recallMemoriesWithTrace, resetRecallQueryCache } from "./memory_recall.js";

export interface MemoryBudgetSnapshot {
  measuredAt: string;
  dbBytes: number;
  dbMb: number;
  rows: {
    total: number;
    active: number;
    archived: number;
    deleted: number;
  };
  avgContentBytes: number;
  horizon: {
    daysObserved: number;
    projectedRowsPerDay: number;
    projectedYearDbMb: number;
  };
}

export interface MemoryBudgetBenchmarkOptions {
  targetMb?: number;
  days?: number;
  eventsPerDay?: number;
  recallQueries?: number;
  growthCheckpoints?: number;
}

export interface MemoryBudgetBenchmarkReport {
  generatedAt: string;
  config: {
    targetMb: number;
    days: number;
    eventsPerDay: number;
    recallQueries: number;
    growthCheckpoints: number;
  };
  storage: {
    rowsInserted: number;
    dbMbBefore: number;
    dbMbAfter: number;
    projectedYearDbMb: number;
    underTarget: boolean;
    growthCurve: Array<{
      day: number;
      rows: number;
      dbMb: number;
      projectedYearDbMb: number;
    }>;
  };
  cache: ReturnType<typeof getRecallQueryCacheStats>;
  process: {
    rssMb: number;
    heapTotalMb: number;
    heapUsedMb: number;
    externalMb: number;
    arrayBuffersMb: number;
    under64Mb: boolean;
  };
  alerts: string[];
}

export async function inspectMemoryBudget(rootPath: string): Promise<MemoryBudgetSnapshot> {
  await ensureMemoryStore(rootPath);
  const measuredAt = new Date().toISOString();

  const dbBytesRaw = await runMemoryStoreSql(
    rootPath,
    "SELECT (PRAGMA_PAGE_COUNT * PRAGMA_PAGE_SIZE) FROM (SELECT PRAGMA_PAGE_COUNT, PRAGMA_PAGE_SIZE FROM pragma_page_count(), pragma_page_size() LIMIT 1);"
  ).catch(async () => {
    const fallback = await runMemoryStoreSql(
      rootPath,
      "SELECT (page_count * page_size) FROM pragma_page_count(), pragma_page_size();"
    );
    return fallback;
  });

  const rowsRaw = await runMemoryStoreSql(
    rootPath,
    [
      "SELECT json_object(",
      "'total', COUNT(*),",
      "'active', SUM(CASE WHEN deleted_at IS NULL THEN 1 ELSE 0 END),",
      "'archived', SUM(CASE WHEN state='archive' THEN 1 ELSE 0 END),",
      "'deleted', SUM(CASE WHEN deleted_at IS NOT NULL THEN 1 ELSE 0 END),",
      "'avgContentBytes', AVG(length(content)),",
      "'minCreatedAt', MIN(created_at),",
      "'maxCreatedAt', MAX(created_at)",
      ")",
      "FROM memories;"
    ].join("\n")
  );

  const dbBytes = Math.max(0, Number(dbBytesRaw.trim()) || 0);
  const parsed = rowsRaw.trim() ? (JSON.parse(rowsRaw.trim()) as Record<string, unknown>) : {};
  const total = asInt(parsed.total);
  const active = asInt(parsed.active);
  const archived = asInt(parsed.archived);
  const deleted = asInt(parsed.deleted);
  const avgContentBytes = Math.max(0, asNum(parsed.avgContentBytes));
  const minCreatedAt = typeof parsed.minCreatedAt === "string" ? parsed.minCreatedAt : "";
  const maxCreatedAt = typeof parsed.maxCreatedAt === "string" ? parsed.maxCreatedAt : "";

  const daysObserved = deriveObservedDays(minCreatedAt, maxCreatedAt);
  const projectedRowsPerDay = daysObserved > 0 ? total / daysObserved : 0;
  const bytesPerRow = total > 0 ? dbBytes / total : Math.max(400, avgContentBytes + 240);
  const projectedYearDbBytes = dbBytes + projectedRowsPerDay * 365 * bytesPerRow;

  return {
    measuredAt,
    dbBytes,
    dbMb: round2(dbBytes / (1024 * 1024)),
    rows: {
      total,
      active,
      archived,
      deleted
    },
    avgContentBytes: round2(avgContentBytes),
    horizon: {
      daysObserved: round2(daysObserved),
      projectedRowsPerDay: round2(projectedRowsPerDay),
      projectedYearDbMb: round2(projectedYearDbBytes / (1024 * 1024))
    }
  };
}

export async function runMemoryBudgetBenchmark(
  rootPath: string,
  options?: MemoryBudgetBenchmarkOptions
): Promise<MemoryBudgetBenchmarkReport> {
  await ensureMemoryStore(rootPath);
  const targetMb = clampNum(options?.targetMb, 300, 1, 10_000);
  const days = clampInt(options?.days, 180, 7, 3650);
  const eventsPerDay = clampInt(options?.eventsPerDay, 24, 1, 500);
  const recallQueries = clampInt(options?.recallQueries, 120, 0, 20_000);
  const growthCheckpoints = clampInt(options?.growthCheckpoints, 12, 2, 120);

  const before = await inspectMemoryBudget(rootPath);
  const rowsInserted = await seedBudgetBenchmarkMemories(rootPath, { days, eventsPerDay });
  resetRecallQueryCache();
  const queryPool = [
    "你还记得我的表达偏好吗",
    "我们之前说过的项目节奏是什么",
    "我喜欢什么样的回答结构",
    "关于旅行和写作我有哪些偏好",
    "你记得我的工作上下文吗",
    "回忆一下我的长期目标",
    "你还记得我对代码风格的要求吗",
    "总结一下我们最近的讨论重点"
  ];
  for (let i = 0; i < recallQueries; i += 1) {
    const query = queryPool[i % queryPool.length];
    await recallMemoriesWithTrace(rootPath, query, { budget: { injectMax: 6, rerankMax: 24 } });
  }
  const cache = getRecallQueryCacheStats();

  const after = await inspectMemoryBudget(rootPath);
  const bytesPerInsertedRow =
    rowsInserted > 0 ? Math.max(1, (after.dbBytes - before.dbBytes) / rowsInserted) : Math.max(1, after.dbBytes / 1000);
  const curve = await collectGrowthCurve(rootPath, days, growthCheckpoints, before.dbBytes, bytesPerInsertedRow);
  const usage = process.memoryUsage();
  const processSnapshot = {
    rssMb: round2(usage.rss / (1024 * 1024)),
    heapTotalMb: round2(usage.heapTotal / (1024 * 1024)),
    heapUsedMb: round2(usage.heapUsed / (1024 * 1024)),
    externalMb: round2(usage.external / (1024 * 1024)),
    arrayBuffersMb: round2((usage.arrayBuffers ?? 0) / (1024 * 1024)),
    under64Mb: usage.rss <= 64 * 1024 * 1024
  };

  const alerts: string[] = [];
  if (after.horizon.projectedYearDbMb > targetMb) {
    alerts.push(`projected_db_mb_exceeded:${round2(after.horizon.projectedYearDbMb)}>${targetMb}`);
  }
  if (!processSnapshot.under64Mb) {
    alerts.push(`process_rss_exceeded:${processSnapshot.rssMb}>64`);
  }
  if (cache.hitRate < 0.2 && recallQueries > 0) {
    alerts.push(`cache_hit_rate_low:${cache.hitRate}<0.2`);
  }

  return {
    generatedAt: new Date().toISOString(),
    config: {
      targetMb,
      days,
      eventsPerDay,
      recallQueries,
      growthCheckpoints
    },
    storage: {
      rowsInserted,
      dbMbBefore: before.dbMb,
      dbMbAfter: after.dbMb,
      projectedYearDbMb: after.horizon.projectedYearDbMb,
      underTarget: after.horizon.projectedYearDbMb <= targetMb,
      growthCurve: curve
    },
    cache,
    process: processSnapshot,
    alerts
  };
}

async function seedBudgetBenchmarkMemories(
  rootPath: string,
  config: { days: number; eventsPerDay: number }
): Promise<number> {
  const dayMs = 24 * 60 * 60 * 1000;
  const now = Date.now();
  const start = now - config.days * dayMs;
  let inserted = 0;

  for (let d = 0; d < config.days; d += 1) {
    const ts = new Date(start + d * dayMs).toISOString();
    const statements: string[] = [];
    for (let i = 0; i < config.eventsPerDay; i += 1) {
      const id = `budget-bench-${d}-${i}`;
      const mod = i % 3;
      const memoryType = mod === 0 ? "episodic" : mod === 1 ? "semantic" : "relational";
      const state = d < config.days * 0.2 ? "cold" : d < config.days * 0.5 ? "warm" : "hot";
      const salience = round2(Math.max(0.1, Math.min(0.98, 0.25 + (i % 10) * 0.06)));
      const content = [
        `budget benchmark day=${d}`,
        `slot=${i}`,
        "用户偏好：先结论后步骤，重视可执行建议。",
        "上下文：项目推进、代码质量、知识整理。"
      ].join(" | ");
      statements.push(
        [
          "INSERT OR IGNORE INTO memories",
          "(id, memory_type, content, salience, state, origin_role, evidence_level, activation_count, last_activated_at, emotion_score, narrative_score, credibility_score, excluded_from_recall, reconsolidation_count, source_event_hash, created_at, updated_at, deleted_at)",
          "VALUES",
          `(${sqlText(id)}, ${sqlText(memoryType)}, ${sqlText(content)}, ${salience}, ${sqlText(state)}, 'user', 'verified', 1, ${sqlText(ts)}, 0.2, 0.4, 0.95, 0, 0, ${sqlText(`seed:${id}`)}, ${sqlText(ts)}, ${sqlText(ts)}, NULL);`
        ].join(" ")
      );
    }
    if (statements.length > 0) {
      await runMemoryStoreSql(rootPath, `BEGIN;\n${statements.join("\n")}\nCOMMIT;`);
      inserted += statements.length;
    }
  }
  return inserted;
}

async function collectGrowthCurve(
  rootPath: string,
  totalDays: number,
  checkpoints: number,
  baseDbBytes: number,
  bytesPerInsertedRow: number
): Promise<Array<{ day: number; rows: number; dbMb: number; projectedYearDbMb: number }>> {
  const out: Array<{ day: number; rows: number; dbMb: number; projectedYearDbMb: number }> = [];
  const step = Math.max(1, Math.floor(totalDays / checkpoints));
  const dayMs = 24 * 60 * 60 * 1000;
  const now = Date.now();
  const start = now - totalDays * dayMs;
  for (let day = step; day <= totalDays; day += step) {
    const checkpointIso = new Date(start + day * dayMs).toISOString();
    const rowsRaw = await runMemoryStoreSql(
      rootPath,
      [
        "SELECT COUNT(*)",
        "FROM memories",
        "WHERE id LIKE 'budget-bench-%'",
        `AND created_at <= ${sqlText(checkpointIso)};`
      ].join("\n")
    );
    const insertedRows = Math.max(0, Number(rowsRaw.trim()) || 0);
    const dbBytes = baseDbBytes + insertedRows * bytesPerInsertedRow;
    const projectedYearDbMb = round2((baseDbBytes + (insertedRows / Math.max(1, day)) * 365 * bytesPerInsertedRow) / (1024 * 1024));
    out.push({
      day,
      rows: insertedRows,
      dbMb: round2(dbBytes / (1024 * 1024)),
      projectedYearDbMb
    });
  }
  if (out.length === 0 || out[out.length - 1]?.day !== totalDays) {
    const rowsRaw = await runMemoryStoreSql(
      rootPath,
      [
        "SELECT COUNT(*)",
        "FROM memories",
        "WHERE id LIKE 'budget-bench-%';"
      ].join("\n")
    );
    const insertedRows = Math.max(0, Number(rowsRaw.trim()) || 0);
    const dbBytes = baseDbBytes + insertedRows * bytesPerInsertedRow;
    out.push({
      day: totalDays,
      rows: insertedRows,
      dbMb: round2(dbBytes / (1024 * 1024)),
      projectedYearDbMb: round2(
        (baseDbBytes + (insertedRows / Math.max(1, totalDays)) * 365 * bytesPerInsertedRow) / (1024 * 1024)
      )
    });
  }
  return out;
}

function asInt(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    return 0;
  }
  return Math.max(0, Math.floor(n));
}

function clampInt(value: number | undefined, fallback: number, min: number, max: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, Math.floor(n)));
}

function clampNum(value: number | undefined, fallback: number, min: number, max: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, n));
}

function asNum(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function deriveObservedDays(minCreatedAt: string, maxCreatedAt: string): number {
  const min = Date.parse(minCreatedAt);
  const max = Date.parse(maxCreatedAt);
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) {
    return 1;
  }
  const days = (max - min) / (24 * 60 * 60 * 1000);
  return Math.max(1, days);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function sqlText(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}
