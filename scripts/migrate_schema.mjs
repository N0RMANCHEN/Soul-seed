#!/usr/bin/env node
// scripts/migrate_schema.mjs
// 人格包 schema 幂等升级工具（P0-0）
// 将 persona.json 从旧版本（如 0.1.0）升级到当前版本（0.3.0）。
//
// Usage:
//   node scripts/migrate_schema.mjs --persona <persona-dir>       # 单个人格包
//   node scripts/migrate_schema.mjs --all --personas-root <dir>   # 批量升级目录下所有 .soulseedpersona 目录
//   node scripts/migrate_schema.mjs --dry-run --persona <path>    # 预览，不写入

import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";

const CURRENT_SCHEMA_VERSION = "0.3.0";

const DEFAULT_PATHS = {
  identity: "identity.json",
  worldview: "worldview.json",
  constitution: "constitution.json",
  habits: "habits.json",
  userProfile: "user_profile.json",
  pinned: "pinned.json",
  cognition: "cognition_state.json",
  soulLineage: "soul_lineage.json",
  lifeLog: "life.log.jsonl",
  memoryDb: "memory.db"
};

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === "--persona") args.persona = argv[i + 1];
    if (argv[i] === "--personas-root") args.personasRoot = argv[i + 1];
    if (argv[i] === "--all") args.all = true;
    if (argv[i] === "--dry-run") args.dryRun = true;
  }
  return args;
}

async function migratePersonaDir(personaDir, dryRun = false) {
  const personaJsonPath = path.join(personaDir, "persona.json");
  if (!fs.existsSync(personaJsonPath)) {
    console.warn(`  [skip] ${personaDir} — persona.json not found`);
    return { status: "skipped", reason: "missing_persona_json" };
  }

  const raw = JSON.parse(await fsp.readFile(personaJsonPath, "utf8"));

  const hadLegacyDefaultModel = typeof raw.defaultModel === "string";

  if (raw.schemaVersion === CURRENT_SCHEMA_VERSION) {
    // 检查 paths 是否完整
    const existingPaths = raw.paths ?? {};
    const missingKeys = Object.keys(DEFAULT_PATHS).filter((k) => !existingPaths[k]);
    if (missingKeys.length === 0 && !hadLegacyDefaultModel) {
      console.log(`  [ok]   ${path.basename(personaDir)} — already at ${CURRENT_SCHEMA_VERSION} with complete paths`);
      return { status: "already_current" };
    }
    // paths 不完整，补全
    const updated = {
      ...raw,
      paths: { ...DEFAULT_PATHS, ...existingPaths }
    };
    delete updated.defaultModel;
    if (!dryRun) {
      await fsp.writeFile(personaJsonPath, JSON.stringify(updated, null, 2) + "\n", "utf8");
    }
    console.log(
      `  [fix]  ${path.basename(personaDir)} — paths completed (added: ${missingKeys.join(", ") || "none"})` +
      `${hadLegacyDefaultModel ? " + removed legacy defaultModel" : ""}` +
      `${dryRun ? " [dry-run]" : ""}`
    );
    return { status: "paths_completed", added: missingKeys, removedDefaultModel: hadLegacyDefaultModel };
  }

  // 版本过旧，升级
  const oldVersion = raw.schemaVersion ?? "unknown";
  const updated = {
    ...raw,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    paths: { ...DEFAULT_PATHS, ...(raw.paths ?? {}) }
  };
  delete updated.defaultModel;

  if (!dryRun) {
    // 备份原文件
    const backupPath = personaJsonPath + `.bak-${oldVersion}`;
    await fsp.copyFile(personaJsonPath, backupPath);
    await fsp.writeFile(personaJsonPath, JSON.stringify(updated, null, 2) + "\n", "utf8");
  }

  console.log(
    `  [upgrade] ${path.basename(personaDir)} — ${oldVersion} → ${CURRENT_SCHEMA_VERSION}${dryRun ? " [dry-run]" : "  (backup saved)"}`
  );
  return {
    status: "upgraded",
    from: oldVersion,
    to: CURRENT_SCHEMA_VERSION,
    removedDefaultModel: hadLegacyDefaultModel
  };
}

async function findPersonaDirs(rootDir) {
  const entries = await fsp.readdir(rootDir, { withFileTypes: true });
  return entries
    .filter((e) => e.isDirectory() && e.name.endsWith(".soulseedpersona"))
    .map((e) => path.join(rootDir, e.name));
}

async function main() {
  const args = parseArgs(process.argv);

  if (args.dryRun) {
    console.log("[dry-run mode] No files will be written.\n");
  }

  let dirs = [];

  if (args.all && args.personasRoot) {
    const rootDir = path.resolve(args.personasRoot);
    if (!fs.existsSync(rootDir)) {
      console.error(`personas-root not found: ${rootDir}`);
      process.exit(1);
    }
    dirs = await findPersonaDirs(rootDir);
    console.log(`Found ${dirs.length} persona dir(s) under ${rootDir}\n`);
  } else if (args.persona) {
    dirs = [path.resolve(args.persona)];
  } else {
    console.error(
      "Usage:\n" +
        "  node scripts/migrate_schema.mjs --persona <path> [--dry-run]\n" +
        "  node scripts/migrate_schema.mjs --all --personas-root <dir> [--dry-run]"
    );
    process.exit(1);
  }

  const results = [];
  for (const dir of dirs) {
    const result = await migratePersonaDir(dir, args.dryRun ?? false);
    results.push({ dir, ...result });
  }

  console.log("\n--- Summary ---");
  const upgraded = results.filter((r) => r.status === "upgraded").length;
  const fixed = results.filter((r) => r.status === "paths_completed").length;
  const current = results.filter((r) => r.status === "already_current").length;
  const skipped = results.filter((r) => r.status === "skipped").length;
  const removedDefaultModel = results.filter((r) => r.removedDefaultModel).length;
  console.log(`upgraded: ${upgraded}  paths_completed: ${fixed}  already_current: ${current}  skipped: ${skipped}`);
  console.log(`defaultModel_removed: ${removedDefaultModel}`);

  if (upgraded + fixed > 0 && !args.dryRun) {
    console.log("\nDone. Run `ss doctor --persona <path>` to verify.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
