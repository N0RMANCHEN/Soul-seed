#!/usr/bin/env node
/**
 * E2: Zero direct-write paths — ensures state file writes only occur in approved modules.
 * Registry source: config/governance/state_write_registry.json
 * Env overrides:
 *   - DIRECT_WRITES_REGISTRY_PATH
 *   - DIRECT_WRITES_SCAN_ROOT
 */
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const DEFAULT_REGISTRY_PATH = "config/governance/state_write_registry.json";
const DEFAULT_SCAN_ROOT = "packages/core/src";

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeRel(p) {
  return p.replace(/\\/g, "/");
}

function stripJsonExt(name) {
  return name.replace(/\.(json|jsonl)$/i, "");
}

function findDuplicates(items) {
  const seen = new Set();
  const dups = new Set();
  for (const item of items) {
    if (seen.has(item)) dups.add(item);
    seen.add(item);
  }
  return [...dups];
}

async function loadRegistry() {
  const registryPath = process.env["DIRECT_WRITES_REGISTRY_PATH"] ?? DEFAULT_REGISTRY_PATH;
  const abs = path.resolve(process.cwd(), registryPath);
  const parsed = JSON.parse(await readFile(abs, "utf8"));
  const stateFiles = Array.isArray(parsed.stateFiles) ? parsed.stateFiles.map(String) : [];
  const allowedWriters = Array.isArray(parsed.allowedWriters) ? parsed.allowedWriters.map((x) => normalizeRel(String(x))) : [];
  const domainFileMap = parsed.domainFileMap && typeof parsed.domainFileMap === "object"
    ? Object.fromEntries(Object.entries(parsed.domainFileMap).map(([k, v]) => [String(k), String(v)]))
    : {};

  const failures = [];
  if (!stateFiles.length) failures.push("stateFiles must be a non-empty array");
  if (!allowedWriters.length) failures.push("allowedWriters must be a non-empty array");
  if (!Object.keys(domainFileMap).length) failures.push("domainFileMap must be a non-empty object");

  for (const dup of findDuplicates(stateFiles)) failures.push(`stateFiles has duplicate entry: ${dup}`);
  for (const dup of findDuplicates(allowedWriters)) failures.push(`allowedWriters has duplicate entry: ${dup}`);

  for (const [domain, stateFile] of Object.entries(domainFileMap)) {
    if (!stateFiles.includes(stateFile)) {
      failures.push(`domainFileMap points to unknown state file: ${domain} -> ${stateFile}`);
    }
  }
  for (const stateFile of stateFiles) {
    const linked = Object.values(domainFileMap).includes(stateFile);
    if (!linked) failures.push(`state file missing domain mapping: ${stateFile}`);
  }
  if (failures.length) {
    const error = new Error(`invalid state write registry: ${failures.join("; ")}`);
    error.name = "RegistryValidationError";
    throw error;
  }

  return { stateFiles, allowedWriters: new Set(allowedWriters), registryPath };
}

async function walkDir(dir, files = []) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory() && !e.name.startsWith(".") && e.name !== "node_modules") {
      await walkDir(full, files);
    } else if (e.isFile() && e.name.endsWith(".ts")) {
      files.push(full);
    }
  }
  return files;
}

async function main() {
  const { stateFiles, allowedWriters, registryPath } = await loadRegistry();
  const violations = [];
  const scanRoot = process.env["DIRECT_WRITES_SCAN_ROOT"] ?? DEFAULT_SCAN_ROOT;
  const srcDir = path.resolve(process.cwd(), scanRoot);
  const srcFiles = await walkDir(srcDir);

  for (const file of srcFiles) {
    const rel = normalizeRel(path.relative(process.cwd(), file));
    if (allowedWriters.has(rel)) continue;

    const content = await readFile(file, "utf8");
    for (const stateFile of stateFiles) {
      const base = stripJsonExt(stateFile);
      const patterns = [
        new RegExp(`["'\`].*${escapeRegex(stateFile)}["'\`]`, "i"),
        new RegExp(`["'\`].*${escapeRegex(base)}["'\`]`, "i"),
        new RegExp(`join\\([^)]*["'\`]${escapeRegex(base)}["'\`]`, "i"),
      ];
      for (const re of patterns) {
        if (re.test(content)) {
          const writePatterns = [
            /writeFile\s*\(/,
            /writeJson\s*\(/,
            /\.writeFile\s*\(/,
            /fs\.writeFile/,
            /writeFileSync/,
          ];
          const hasWrite = writePatterns.some((wp) => wp.test(content));
          if (hasWrite) {
            violations.push(`${rel}: may write to ${stateFile} (not in allowed list)`);
            break;
          }
        }
      }
    }
  }

  if (violations.length > 0) {
    console.error(
      JSON.stringify(
        { ok: false, gate: "direct-writes", registryPath, scanRoot, violations },
        null,
        2
      )
    );
    process.exit(1);
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        gate: "direct-writes",
        registryPath,
        scanRoot,
        stateFileCount: stateFiles.length,
        allowWriterCount: allowedWriters.size,
        message: "No unauthorized state file writes",
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
