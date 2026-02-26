#!/usr/bin/env node
import { readFile, access } from "node:fs/promises";
import path from "node:path";

async function exists(relPath) {
  try {
    await access(path.resolve(process.cwd(), relPath));
    return true;
  } catch {
    return false;
  }
}

async function countLines(relPath) {
  const abs = path.resolve(process.cwd(), relPath);
  const raw = await readFile(abs, "utf8");
  return raw.split("\n").length;
}

function severityFor(rule, checks) {
  const s = checks?.[rule];
  return s === "error" ? "error" : "warn";
}

function recordIssue({ rule, message, checks, failures, warnings }) {
  if (severityFor(rule, checks) === "error") failures.push(message);
  else warnings.push(message);
}

async function main() {
  const rulesPath = path.resolve(process.cwd(), "config/governance/architecture_rules.json");
  const rules = JSON.parse(await readFile(rulesPath, "utf8"));
  const failures = [];
  const warnings = [];

  const checks = rules.checks ?? {};

  // 1) Required docs must exist.
  for (const rel of rules.requiredDocs ?? []) {
    if (!(await exists(rel))) {
      recordIssue({
        rule: "requiredDocs",
        message: `missing required doc: ${rel}`,
        checks,
        failures,
        warnings,
      });
    }
  }

  // 2) Line limits (warn by default).
  const maxDefault = Number(rules.maxFileLines?.default ?? 800);
  const maxHard = Number(rules.maxFileLines?.hard ?? 1200);
  const allowlist = new Set(rules.lineLimitAllowlist ?? []);
  const watchedFiles = [
    "packages/core/src/index.ts",
    "packages/cli/src/index.ts",
    "packages/mcp-server/src/index.ts",
  ];
  for (const rel of watchedFiles) {
    if (!(await exists(rel))) continue;
    const lines = await countLines(rel);
    if (lines > maxHard && !allowlist.has(rel)) {
      recordIssue({
        rule: "lineLimits",
        message: `hard line-limit exceeded: ${rel} (${lines} > ${maxHard})`,
        checks,
        failures,
        warnings,
      });
    } else if (lines > maxDefault) {
      recordIssue({
        rule: "lineLimits",
        message: `line-limit advisory: ${rel} (${lines} > ${maxDefault})`,
        checks,
        failures,
        warnings,
      });
    }
  }

  // 3) Core export surface width (warn).
  const coreIndex = "packages/core/src/index.ts";
  if (await exists(coreIndex)) {
    const raw = await readFile(path.resolve(process.cwd(), coreIndex), "utf8");
    const wildcardCount = raw
      .split("\n")
      .filter((l) => l.trim().startsWith("export * from"))
      .length;
    if (wildcardCount > 80) {
      recordIssue({
        rule: "coreExportSurface",
        message: `core export surface is wide: export* count=${wildcardCount}`,
        checks,
        failures,
        warnings,
      });
    }
  }

  // 3b) Internal-only modules must not be re-exported (from core_export_whitelist.json).
  const whitelistPath = path.resolve(process.cwd(), "config/governance/core_export_whitelist.json");
  if (await exists(whitelistPath) && (await exists(coreIndex))) {
    const whitelist = JSON.parse(await readFile(whitelistPath, "utf8"));
    const internalModules = whitelist.internalModules ?? [];
    const raw = await readFile(path.resolve(process.cwd(), coreIndex), "utf8");
    const exportLines = raw.split("\n").filter((l) => /export\s+.*\s+from\s+/.test(l) || l.trim().startsWith("export * from"));
    for (const mod of internalModules) {
      const pattern = new RegExp(`["'\`].*${mod.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\.js["'\`]`);
      if (exportLines.some((line) => pattern.test(line))) {
        recordIssue({
          rule: "internalModuleReExport",
          message: `internal-only module "${mod}" must not be re-exported from core index`,
          checks,
          failures,
          warnings,
        });
      }
    }
  }

  // 4) Workspace version consistency (warn for now).
  const rootPkg = JSON.parse(await readFile(path.resolve(process.cwd(), "package.json"), "utf8"));
  const rootVersion = String(rootPkg.version ?? "");
  const depMismatches = [];
  for (const rel of ["packages/cli/package.json", "packages/mcp-server/package.json"]) {
    if (!(await exists(rel))) continue;
    const pkg = JSON.parse(await readFile(path.resolve(process.cwd(), rel), "utf8"));
    const dep = pkg.dependencies?.["@soulseed/core"];
    if (typeof dep === "string" && dep !== rootVersion && dep !== "workspace:*") {
      depMismatches.push(`${rel}: @soulseed/core=${dep}, root=${rootVersion}`);
    }
  }
  for (const mismatch of depMismatches) {
    recordIssue({
      rule: "workspaceVersionConsistency",
      message: `workspace version mismatch: ${mismatch}`,
      checks,
      failures,
      warnings,
    });
  }

  // 5) Plan naming mix (warn): both H1/H2/H3 and Ha/Hb/Hc exist in doc/plans.
  const hasHNumeric = (await exists("doc/plans/H1-Foundation.md")) || (await exists("doc/plans/H2-State-Modules.md")) || (await exists("doc/plans/H3-Validation-and-Guards.md"));
  const hasHAlpha = (await exists("doc/plans/Ha-State-Infra-Plan.md")) || (await exists("doc/plans/Hb-Mind-Model-State-Modules.md")) || (await exists("doc/plans/Hc-Verification-Governance.md"));
  if (hasHNumeric && hasHAlpha) {
    recordIssue({
      rule: "planNamingMix",
      message: "plan naming mix detected: H1/H2/H3 and Ha/Hb/Hc both present",
      checks,
      failures,
      warnings,
    });
  }

  const ok = failures.length === 0;
  const payload = {
    ok,
    gate: "architecture-governance",
    rulesVersion: rules.version ?? "unknown",
    failures,
    warnings,
  };

  const out = JSON.stringify(payload, null, 2);
  if (!ok) {
    console.error(out);
    process.exit(1);
  }
  console.log(out);
}

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        gate: "architecture-governance",
        failures: [error instanceof Error ? error.message : String(error)],
      },
      null,
      2
    )
  );
  process.exit(1);
});
