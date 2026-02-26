/**
 * Hb-2-2 Compat Checklist CI Validation Tests
 *
 * - Positive: compat_lint passes with valid checklist
 * - Negative: compat_lint fails when entry has empty evidencePath or invalid path
 */
import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mkdtemp, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../..");

function runCompatLint(checklistPath) {
  return new Promise((resolve) => {
    const scriptPath = path.join(ROOT, "scripts", "compat_lint.mjs");
    const proc = spawn("node", [scriptPath, `--checklist=${checklistPath}`], {
      cwd: ROOT,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    proc.stdout?.on("data", (d) => (stdout += d.toString()));
    proc.stderr?.on("data", (d) => (stderr += d.toString()));
    proc.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}

test("compat_lint passes with valid checklist", async () => {
  const result = await runCompatLint(path.join(ROOT, "config", "compat_checklist.json"));
  assert.equal(result.code, 0, `Expected exit 0, got ${result.code}. stderr: ${result.stderr}`);
});

test("compat_lint fails when entry has empty evidencePath", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-compat-lint-"));
  const badChecklist = path.join(tmpDir, "bad_checklist.json");
  await writeFile(
    badChecklist,
    JSON.stringify({
      schemaVersion: "1.0",
      items: [
        {
          id: "COMPAT-ENTRY-01",
          module: "H/P0-0",
          category: "entry",
          description: "test",
          evidencePath: "",
          status: "pass",
        },
      ],
    }),
    "utf8"
  );

  const result = await runCompatLint(badChecklist);
  assert.equal(result.code, 1);
  assert.ok(result.stderr.includes("evidencePath") || result.stdout.includes("evidencePath"));
});

test("compat_lint fails when evidencePath does not resolve", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-compat-lint-"));
  const badChecklist = path.join(tmpDir, "bad_checklist.json");
  await writeFile(
    badChecklist,
    JSON.stringify({
      schemaVersion: "1.0",
      items: [
        {
          id: "COMPAT-ENTRY-01",
          module: "H/P0-0",
          category: "entry",
          description: "test",
          evidencePath: "nonexistent/path/to/file.ts",
          status: "pass",
        },
      ],
    }),
    "utf8"
  );

  const result = await runCompatLint(badChecklist);
  assert.equal(result.code, 1);
});
