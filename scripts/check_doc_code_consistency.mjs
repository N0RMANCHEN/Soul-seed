#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import path from "node:path";
import { existsSync } from "node:fs";

async function readJson(relPath) {
  const abs = path.resolve(process.cwd(), relPath);
  return JSON.parse(await readFile(abs, "utf8"));
}

async function readText(relPath) {
  const abs = path.resolve(process.cwd(), relPath);
  return readFile(abs, "utf8");
}

async function checkNaming(naming, failures, warnings) {
  const roadmapFile = String(naming.roadmapFile ?? "");
  if (!roadmapFile) {
    failures.push("naming.roadmapFile is required");
    return;
  }
  if (!existsSync(path.resolve(process.cwd(), roadmapFile))) {
    failures.push(`naming roadmap missing: ${roadmapFile}`);
    return;
  }

  const content = await readText(roadmapFile);
  const headingPattern = new RegExp(`^###\\s+(${String(naming.taskIdPattern ?? "AG\\\\/P[0-2]-\\\\d+")})\\b`, "gm");
  const ids = [];
  for (const match of content.matchAll(headingPattern)) {
    ids.push(String(match[1]));
  }
  if (!ids.length) {
    failures.push(`no task ids found by pattern in ${roadmapFile}`);
    return;
  }

  const seen = new Set();
  const dup = new Set();
  for (const id of ids) {
    if (seen.has(id)) dup.add(id);
    seen.add(id);
  }
  for (const id of dup) {
    failures.push(`duplicate task id in roadmap: ${id}`);
  }

  const requiredGroups = Array.isArray(naming.requiredGroups) ? naming.requiredGroups.map(String) : [];
  for (const group of requiredGroups) {
    const hasGroup = ids.some((id) => id.startsWith(`${group}-`));
    if (!hasGroup) {
      failures.push(`missing required naming group in roadmap: ${group}`);
    }
  }

  const statusLines = content.match(/^- 状态：`(todo|in_progress|blocked|done|deferred)`/gm) ?? [];
  if (!statusLines.length) {
    warnings.push("no normalized status markers found in architecture governance roadmap");
  }
}

async function checkPathReferences(pathReferences, failures) {
  for (const item of pathReferences) {
    const doc = String(item.doc ?? "");
    const targetPath = String(item.path ?? "");
    if (!doc || !targetPath) {
      failures.push("pathReferences entry requires doc and path");
      continue;
    }
    const docAbs = path.resolve(process.cwd(), doc);
    if (!existsSync(docAbs)) {
      failures.push(`pathReferences doc missing: ${doc}`);
      continue;
    }
    const docText = await readFile(docAbs, "utf8");
    if (!docText.includes(targetPath)) {
      failures.push(`path reference not found in doc: ${doc} -> ${targetPath}`);
      continue;
    }
    const targetAbs = path.resolve(process.cwd(), targetPath);
    if (!existsSync(targetAbs)) {
      failures.push(`referenced path does not exist: ${targetPath} (from ${doc})`);
    }
  }
}

async function checkFieldAssertions(fieldAssertions, failures) {
  for (const item of fieldAssertions) {
    const doc = String(item.doc ?? "");
    const field = String(item.field ?? "unknown-field");
    const mustContain = String(item.mustContain ?? "");
    if (!doc || !mustContain) {
      failures.push("fieldAssertions entry requires doc and mustContain");
      continue;
    }
    const docAbs = path.resolve(process.cwd(), doc);
    if (!existsSync(docAbs)) {
      failures.push(`fieldAssertions doc missing: ${doc}`);
      continue;
    }
    const docText = await readFile(docAbs, "utf8");
    if (!docText.includes(mustContain)) {
      failures.push(`field assertion failed (${field}): ${doc} missing \"${mustContain}\"`);
    }
  }
}

async function main() {
  const rulePath = "config/governance/doc_code_consistency_rules.json";
  const rules = await readJson(rulePath);

  const failures = [];
  const warnings = [];

  await checkNaming(rules.naming ?? {}, failures, warnings);
  await checkPathReferences(Array.isArray(rules.pathReferences) ? rules.pathReferences : [], failures);
  await checkFieldAssertions(Array.isArray(rules.fieldAssertions) ? rules.fieldAssertions : [], failures);

  const result = {
    ok: failures.length === 0,
    gate: "doc-code-consistency",
    rulesVersion: String(rules.version ?? "unknown"),
    failures,
    warnings
  };

  const out = JSON.stringify(result, null, 2);
  if (result.ok) {
    console.log(out);
    return;
  }
  console.error(out);
  process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
