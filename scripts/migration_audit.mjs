#!/usr/bin/env node
// scripts/migration_audit.mjs
// 迁移一致性对账工具（P3-3）
// Usage: node scripts/migration_audit.mjs --persona <path> [--out <path>]
// Exit code 1 if critical checks fail.

import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";

const distIndex = new URL("../packages/core/dist/index.js", import.meta.url).pathname;
if (!fs.existsSync(distIndex)) {
  console.error("[migration-audit] Build required: npm run build");
  process.exit(1);
}

const {
  doctorPersona,
  runMemoryStoreSql,
  recallMemoriesWithTrace
} = await import("../packages/core/dist/index.js");

function parseArg(argv, flag) {
  const idx = argv.indexOf(flag);
  return idx >= 0 ? argv[idx + 1] : null;
}

async function findLatestMigrationReport(personaPath) {
  // Search in persona dir and workspace root
  const candidates = [
    path.join(personaPath, "migration-backups"),
    path.join(process.cwd(), "migration-backups")
  ];
  for (const root of candidates) {
    if (!fs.existsSync(root)) continue;
    const dirs = (await fsp.readdir(root)).sort().reverse();
    for (const dir of dirs) {
      const reportPath = path.join(root, dir, "memory-migration-report.json");
      if (fs.existsSync(reportPath)) {
        return reportPath;
      }
    }
  }
  return null;
}

async function main() {
  const argv = process.argv.slice(2);
  const personaPath = parseArg(argv, "--persona");
  const outPath = parseArg(argv, "--out");

  if (!personaPath) {
    console.error(
      "[migration-audit] Usage: node scripts/migration_audit.mjs --persona <path> [--out <path>]"
    );
    process.exit(1);
  }

  const timestamp = new Date().toISOString();
  const checks = [];

  // ── 1. 找到最近一次迁移报告 ──────────────────────────────────────────
  const reportPath = await findLatestMigrationReport(personaPath);
  let migrationReport = null;
  if (reportPath) {
    try {
      migrationReport = JSON.parse(await fsp.readFile(reportPath, "utf8"));
      checks.push({ name: "migration_report_found", pass: true, detail: reportPath });
    } catch {
      checks.push({
        name: "migration_report_found",
        pass: false,
        detail: `Failed to parse migration report: ${reportPath}`
      });
    }
  } else {
    checks.push({
      name: "migration_report_found",
      pass: false,
      detail: "No migration report found — run `ss memory compact` first"
    });
  }

  // ── 2. Doctor 健康检查（涵盖孤儿 hash、归档完整性、schema）──────────
  const doctor = await doctorPersona(personaPath);
  checks.push({
    name: "doctor_health",
    pass: doctor.ok,
    detail: doctor.ok
      ? "All doctor checks passed"
      : `${doctor.issues.length} issue(s): ${doctor.issues.map((i) => i.code).join(", ")}`
  });

  // Helper: sqlite3 CLI returns plain text; single-value queries return just the number as a string
  async function sqlCount(sql) {
    const out = (await runMemoryStoreSql(personaPath, sql)).trim();
    return Number(out) || 0;
  }
  // Multi-value per row: columns separated by "|"
  async function sqlPipeRow(sql) {
    const out = (await runMemoryStoreSql(personaPath, sql)).trim();
    return out ? out.split("|").map((v) => v.trim()) : [];
  }

  // ── 3. 记忆数量对账 ──────────────────────────────────────────────────
  const currentMemoryCount = await sqlCount(
    "SELECT COUNT(*) FROM memories WHERE deleted_at IS NULL"
  );

  if (migrationReport) {
    const preCount = migrationReport.workingSet?.items ?? 0;
    const delta = Math.abs(currentMemoryCount - preCount);
    const deltaRate = preCount > 0 ? delta / preCount : 0;
    const shrunk = currentMemoryCount < preCount * 0.7;
    checks.push({
      name: "memory_count_consistency",
      pass: !shrunk,
      detail: `pre-migration=${preCount}, current=${currentMemoryCount}, delta=${delta} (${(deltaRate * 100).toFixed(1)}%)${shrunk ? " — WARN: memory count shrank >30%" : ""}`
    });
  } else {
    checks.push({
      name: "memory_count_consistency",
      pass: currentMemoryCount > 0,
      detail: `current memories=${currentMemoryCount} (no pre-migration baseline available)`
    });
  }

  // ── 4. source_event_hash 覆盖率 ─────────────────────────────────────
  const hashRow = await sqlPipeRow(
    "SELECT COUNT(*), SUM(CASE WHEN source_event_hash IS NOT NULL THEN 1 ELSE 0 END) FROM memories WHERE deleted_at IS NULL"
  );
  const totalMem = Number(hashRow[0]) || 0;
  const withHash = Number(hashRow[1]) || 0;
  const hashRate = totalMem > 0 ? withHash / totalMem : 0;
  checks.push({
    name: "source_hash_coverage",
    pass: true,
    detail: `${withHash}/${totalMem} memories have source_event_hash (${(hashRate * 100).toFixed(1)}%)`
  });

  // ── 5. 归档段完整性 ──────────────────────────────────────────────────
  let archiveCount = 0;
  let archiveMissingChecksum = 0;
  try {
    const archRow = await sqlPipeRow(
      "SELECT COUNT(*), SUM(CASE WHEN checksum IS NULL THEN 1 ELSE 0 END) FROM archive_segments"
    );
    archiveCount = Number(archRow[0]) || 0;
    archiveMissingChecksum = Number(archRow[1]) || 0;
  } catch {
    // archive_segments table may not exist in older schemas
  }
  checks.push({
    name: "archive_segments_integrity",
    pass: archiveMissingChecksum === 0,
    detail:
      archiveCount === 0
        ? "No archive segments (no compact run yet)"
        : `${archiveCount} segments, ${archiveMissingChecksum} missing checksum`
  });

  // ── 6. 召回可达性冒烟测试 ────────────────────────────────────────────
  // 用 json_group_array 获取可解析的 JSON 行
  const topRowsJson = (await runMemoryStoreSql(
    personaPath,
    "SELECT COALESCE((SELECT json_group_array(json_object('id',id,'content',content)) FROM (SELECT id,content FROM memories WHERE deleted_at IS NULL AND excluded_from_recall=0 ORDER BY salience DESC,activation_count DESC LIMIT 5)),'[]')"
  )).trim();
  let topMemories = [];
  try { topMemories = JSON.parse(topRowsJson); } catch { /* ignore */ }

  let recallPass = false;
  let recallDetail = "";
  let recallConsistency = null;

  if (topMemories.length > 0) {
    const sampleContent = topMemories[0].content ?? "";
    const sampleQuery = sampleContent.slice(0, 80);
    try {
      const result = await recallMemoriesWithTrace(personaPath, sampleQuery, {
        budget: { candidateMax: 50, rerankMax: 10, injectMax: 5 }
      });
      const selectedSet = new Set(result.selectedIds);
      const topIds = topMemories.slice(0, 3).map((r) => r.id);
      const hitCount = topIds.filter((id) => selectedSet.has(id)).length;
      const hitRate = topIds.length > 0 ? hitCount / topIds.length : 0;
      recallPass = result.selectedIds.length > 0;
      recallDetail = `query="${sampleQuery.slice(0, 40)}…", injected=${result.selectedIds.length}, top-3-hit=${hitCount}/3`;
      recallConsistency = {
        query: sampleQuery,
        injectedCount: result.selectedIds.length,
        top3HitRate: hitRate,
        selectedIds: result.selectedIds
      };
    } catch (e) {
      recallPass = false;
      recallDetail = `Recall failed: ${e.message}`;
    }
  } else {
    recallPass = false;
    recallDetail = "No recallable memories — memory.db may be empty";
  }

  checks.push({ name: "recall_smoke_test", pass: recallPass, detail: recallDetail });

  // ── 7. Recall trace 持久化确认 ──────────────────────────────────────
  let traceCount = 0;
  try {
    traceCount = await sqlCount("SELECT COUNT(*) FROM recall_traces");
  } catch {
    // table may not exist yet
  }
  checks.push({
    name: "recall_traces_persisted",
    pass: true,
    detail: `${traceCount} recall traces in db`
  });

  // ── 8. 迁移后 life.log 链完整性 ─────────────────────────────────────
  // doctor 已涵盖，此处做补充摘要
  const lifelogIssues = doctor.issues.filter((i) =>
    ["life_log_hash_chain_broken", "scar_missing"].includes(i.code)
  );
  checks.push({
    name: "lifelog_chain_integrity",
    pass: lifelogIssues.length === 0,
    detail:
      lifelogIssues.length === 0
        ? "Life.log hash chain intact"
        : `Chain issues: ${lifelogIssues.map((i) => i.code).join(", ")}`
  });

  // ── 综合判断 ─────────────────────────────────────────────────────────
  const CRITICAL = ["doctor_health", "recall_smoke_test", "lifelog_chain_integrity"];
  const criticalPass = checks.filter((c) => CRITICAL.includes(c.name)).every((c) => c.pass);
  const allPass = checks.every((c) => c.pass);

  const report = {
    auditId: `migration-audit-${Date.now()}`,
    timestamp,
    personaPath,
    migrationReportPath: reportPath,
    pass: criticalPass,
    allChecksPass: allPass,
    checksTotal: checks.length,
    checksPassed: checks.filter((c) => c.pass).length,
    checks,
    recallConsistency,
    migrationSummary: migrationReport
      ? {
          migratedAt: migrationReport.migratedAt,
          lifeLog: migrationReport.lifeLog,
          workingSet: migrationReport.workingSet,
          archive: migrationReport.archive
        }
      : null,
    currentState: {
      memoryCount: currentMemoryCount,
      archiveSegments: archiveCount,
      recallTraces: traceCount,
      doctorOk: doctor.ok
    }
  };

  const reportDir = path.join(process.cwd(), "reports", "migration");
  await fsp.mkdir(reportDir, { recursive: true });
  const finalOut = outPath ?? path.join(reportDir, `audit-${Date.now()}.json`);
  await fsp.writeFile(finalOut, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  console.log(`[migration-audit] report : ${finalOut}`);
  console.log(
    `[migration-audit] checks : ${report.checksPassed}/${report.checksTotal} passed`
  );
  console.log(`[migration-audit] pass   : ${report.pass}`);

  if (!report.pass) {
    console.error("[migration-audit] Critical failures:");
    checks
      .filter((c) => CRITICAL.includes(c.name) && !c.pass)
      .forEach((c) => console.error(`  ✗ ${c.name}: ${c.detail}`));
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error("[migration-audit] Fatal:", e);
  process.exit(1);
});
