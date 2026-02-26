import test from "node:test";
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..", "..", "..");

test("Appendix A schemas validate on fixtures (H/P1-18)", () => {
  const result = execSync("node scripts/validate_appendix_a.mjs", {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 1024 * 1024,
  });
  const parsed = JSON.parse(result);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.schemaCount, 4);
});
