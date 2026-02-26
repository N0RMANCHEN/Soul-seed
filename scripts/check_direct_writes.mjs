#!/usr/bin/env node
/**
 * E2: Zero direct-write paths — ensures state file writes only occur in approved modules.
 * Approved: state_delta_apply.ts, mood_state.ts, relationship_state.ts, interests.ts,
 * social_graph.ts, persona.ts (legacy fallback paths only).
 */
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const STATE_FILES = [
  "mood_state.json",
  "emotion_episodes.jsonl",
  "relationship_state.json",
  "interests.json",
  "cognition_state.json",
  "voice_profile.json",
  "social_graph.json",
  "goals.json",
  "beliefs.json",
  "values_rules.json",
  "personality_profile.json",
  "people_registry.json",
  "genome.json",
  "epigenetics.json",
];

const ALLOWED_FILES = new Set([
  "packages/core/src/state_delta_apply.ts",
  "packages/core/src/goals_state.ts",
  "packages/core/src/goal_store.ts",
  "packages/core/src/beliefs_state.ts",
  "packages/core/src/mood_state.ts",
  "packages/core/src/emotion_episode_manager.ts",
  "packages/core/src/relationship_state.ts",
  "packages/core/src/interests.ts",
  "packages/core/src/social_graph.ts",
  "packages/core/src/persona.ts",
  "packages/core/src/compat_migration.ts",
  "packages/core/src/persona_compile.ts",
  "packages/core/src/package_snapshotter.ts",
  "packages/core/src/people_registry.ts",
  "packages/core/src/genome.ts",
]);

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
  const violations = [];
  const srcDir = path.join(process.cwd(), "packages/core/src");
  const srcFiles = await walkDir(srcDir);

  for (const file of srcFiles) {
    const rel = path.relative(process.cwd(), file).replace(/\\/g, "/");
    if (ALLOWED_FILES.has(rel)) continue;

    const content = await readFile(file, "utf8");
    for (const stateFile of STATE_FILES) {
      const base = stateFile.replace(".json", "");
      const patterns = [
        new RegExp(`["'\`].*${stateFile}["'\`]`, "i"),
        new RegExp(`["'\`].*${base}["'\`]`, "i"),
        new RegExp(`join\\([^)]*["'\`]${base}["'\`]`, "i"),
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
        { ok: false, gate: "direct-writes", violations },
        null,
        2
      )
    );
    process.exit(1);
  }

  console.log(
    JSON.stringify(
      { ok: true, gate: "direct-writes", message: "No unauthorized state file writes" },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
