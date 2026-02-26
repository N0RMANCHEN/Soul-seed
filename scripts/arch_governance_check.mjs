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

async function main() {
  const rulesPath = path.resolve(process.cwd(), "config/governance/architecture_rules.json");
  const rules = JSON.parse(await readFile(rulesPath, "utf8"));
  const failures = [];
  const warnings = [];

  const checks = rules.checks ?? {};

  // 1) Required docs must exist.
  for (const rel of rules.requiredDocs ?? []) {
    if (!(await exists(rel))) {
      const item = `missing required doc: ${rel}`;
      if (severityFor("requiredDocs", checks) === "error") failures.push(item);
      else warnings.push(item);
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
      const item = `hard line-limit exceeded: ${rel} (${lines} > ${maxHard})`;
      if (severityFor("lineLimits", checks) === "error") failures.push(item);
      else warnings.push(item);
    } else if (lines > maxDefault) {
      warnings.push(`line-limit advisory: ${rel} (${lines} > ${maxDefault})`);
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
      warnings.push(`core export surface is wide: export* count=${wildcardCount}`);
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
    warnings.push(`workspace version mismatch: ${mismatch}`);
  }

  // 5) Plan naming mix (warn): both H1/H2/H3 and Ha/Hb/Hc exist in doc/plans.
  const hasHNumeric = (await exists("doc/plans/H1-Foundation.md")) || (await exists("doc/plans/H2-State-Modules.md")) || (await exists("doc/plans/H3-Validation-and-Guards.md"));
  const hasHAlpha = (await exists("doc/plans/Ha-State-Infra-Plan.md")) || (await exists("doc/plans/Hb-Mind-Model-State-Modules.md")) || (await exists("doc/plans/Hc-Verification-Governance.md"));
  if (hasHNumeric && hasHAlpha) {
    warnings.push("plan naming mix detected: H1/H2/H3 and Ha/Hb/Hc both present");
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
