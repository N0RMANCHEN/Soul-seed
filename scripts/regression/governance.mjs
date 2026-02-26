#!/usr/bin/env node
/**
 * H/P1-10 — Governance Regression Harness
 *
 * Runs programmatic checks for governance items. Each item in
 * config/regression/governance_items.json must have a corresponding check.
 */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const root = join(__dirname, "..", "..");

async function main() {
  const itemsPath = join(root, "config/regression/governance_items.json");
  const items = JSON.parse(await readFile(itemsPath, "utf8"));
  const results = [];

  // Dynamic import of core for gate checks
  const core = await import(join(root, "packages/core/dist/index.js"));

  for (const item of items.items) {
    let pass = false;
    let reason = "";
    try {
      switch (item.id) {
        case "epigenetics-evidence": {
          const proposal = {
            turnId: "gov-1",
            proposedAt: new Date().toISOString(),
            deltas: [
              {
                type: "epigenetics",
                targetId: "self",
                patch: { emotion_sensitivity: 0.02 },
                confidence: 0.9,
                supportingEventHashes: [],
                notes: "",
              },
            ],
          };
          const results_g = core.runDeltaGates(proposal, { personaRoot: "/tmp", genome: { locked: false } });
          pass = results_g[0]?.verdict === "reject" && results_g[0]?.reason?.includes("supporting");
          reason = pass ? "reject with evidence reason" : `got ${results_g[0]?.verdict}`;
          break;
        }
        case "epigenetics-trait-whitelist": {
          const proposal = {
            turnId: "gov-2",
            proposedAt: new Date().toISOString(),
            deltas: [
              {
                type: "epigenetics",
                targetId: "self",
                patch: { custom_new_trait: 0.02 },
                confidence: 0.9,
                supportingEventHashes: ["h1", "h2"],
                notes: "",
              },
            ],
          };
          const results_g = core.runDeltaGates(proposal, {
            personaRoot: "/tmp",
            genome: { locked: false },
            lifeEventHashes: new Set(["h1", "h2"]),
          });
          pass = results_g[0]?.verdict === "reject" && results_g[0]?.reason?.includes("whitelist");
          reason = pass ? "reject unapproved trait" : `got ${results_g[0]?.verdict}`;
          break;
        }
        case "relationship-rate-limit": {
          const proposal = {
            turnId: "gov-3",
            proposedAt: new Date().toISOString(),
            deltas: [
              {
                type: "relationship",
                targetId: "user-1",
                patch: { trust: 0.15 },
                confidence: 0.9,
                supportingEventHashes: [],
                notes: "",
              },
            ],
          };
          const results_g = core.runDeltaGates(proposal, { personaRoot: "/tmp" });
          pass = results_g[0]?.verdict === "reject";
          reason = pass ? "reject large delta" : `got ${results_g[0]?.verdict}`;
          break;
        }
        case "invariant-table-complete": {
          const { loadInvariantTable, checkInvariantCompleteness } = core;
          const rules = loadInvariantTable(join(root, "config/h0"));
          const r = checkInvariantCompleteness(rules);
          pass = r.complete === true;
          reason = pass ? "complete" : r.missingDomains?.join(", ") ?? "unknown";
          break;
        }
        case "direct-writes-gate": {
          const { execSync } = await import("node:child_process");
          try {
            execSync("node scripts/check_direct_writes.mjs", { cwd: root, stdio: "pipe" });
            pass = true;
            reason = "no violations";
          } catch (e) {
            pass = false;
            reason = "direct-writes check failed";
          }
          break;
        }
        case "relationship-continuity": {
          const { execSync } = await import("node:child_process");
          try {
            execSync("node scripts/regression/relationship_continuity.mjs", { cwd: root, stdio: "pipe" });
            pass = true;
            reason = "entity hit rate + card injection pass";
          } catch (e) {
            pass = false;
            reason = "relationship continuity regression failed";
          }
          break;
        }
        case "emotional-depth": {
          const { execSync } = await import("node:child_process");
          try {
            execSync("node scripts/regression/emotional_depth.mjs", { cwd: root, stdio: "pipe" });
            pass = true;
            reason = "layer presence + trigger binding pass";
          } catch (e) {
            pass = false;
            reason = "emotional depth regression failed";
          }
          break;
        }
        case "appendix-a-schemas": {
          const { execSync } = await import("node:child_process");
          try {
            execSync("node scripts/validate_appendix_a.mjs", { cwd: root, stdio: "pipe" });
            pass = true;
            reason = "all 4 schemas validate";
          } catch (e) {
            pass = false;
            reason = "appendix A schema validation failed";
          }
          break;
        }
        default:
          pass = false;
          reason = "no check implemented";
      }
    } catch (err) {
      reason = err.message ?? String(err);
    }
    results.push({ id: item.id, pass, reason });
  }

  const failed = results.filter((r) => !r.pass);
  const report = { ok: failed.length === 0, items: results, failed: failed.map((r) => r.id) };
  console.log(JSON.stringify(report, null, 2));
  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
