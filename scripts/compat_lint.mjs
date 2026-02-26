#!/usr/bin/env node
/**
 * Hb-2-2 Compat Checklist CI Validation
 *
 * Validates:
 * - All Phase H modules have checklist entries
 * - All entries have non-empty evidencePath
 * - All evidence paths resolve to existing files
 *
 * Run: node scripts/compat_lint.mjs
 * Exit: 0 on pass, 1 on fail
 */
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const checklistPathArg = process.argv.find((a) => a.startsWith("--checklist="));
const CHECKLIST_PATH = checklistPathArg
  ? path.resolve(process.cwd(), checklistPathArg.slice("--checklist=".length))
  : path.join(ROOT, "config", "compat_checklist.json");

const REQUIRED_MODULES = [
  "H/P0-0",
  "H/P0-1",
  "H/P0-2",
  "H/P0-3",
  "H/P0-4",
  "H/P1-0",
  "H/P1-1",
  "H/P1-2",
  "H/P1-3",
  "H/P1-4",
  "H/P1-5",
  "H/P1-6",
];

async function main() {
  const raw = await readFile(CHECKLIST_PATH, "utf8");
  const checklist = JSON.parse(raw);

  const errors = [];
  const modulesWithEntries = new Set();

  for (const item of checklist.items) {
    modulesWithEntries.add(item.module);

    if (!item.evidencePath || String(item.evidencePath).trim() === "") {
      errors.push(`${item.id}: evidencePath is empty`);
      continue;
    }

    const evidencePath = path.join(ROOT, item.evidencePath);
    if (!existsSync(evidencePath)) {
      errors.push(`${item.id}: evidencePath "${item.evidencePath}" does not resolve (missing file)`);
    }
  }

  for (const mod of REQUIRED_MODULES) {
    if (!modulesWithEntries.has(mod)) {
      errors.push(`Module ${mod} has no checklist entry`);
    }
  }

  if (errors.length > 0) {
    console.error(JSON.stringify({ ok: false, gate: "compat-checklist", errors }, null, 2));
    process.exit(1);
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        gate: "compat-checklist",
        message: "All checklist items valid, evidence paths resolve",
        itemCount: checklist.items.length,
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
