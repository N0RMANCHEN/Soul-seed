#!/usr/bin/env node
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const GATE_SCRIPT = path.resolve(process.cwd(), "scripts/check_direct_writes.mjs");

async function setupFixture(structure) {
  const root = await mkdtemp(path.join(tmpdir(), "soulseed-direct-writes-test-"));
  for (const [rel, content] of Object.entries(structure)) {
    const abs = path.join(root, rel);
    await mkdir(path.dirname(abs), { recursive: true });
    await writeFile(abs, content, "utf8");
  }
  return root;
}

function runGate({ cwd, registryPath, scanRoot }) {
  return spawnSync(
    process.execPath,
    [GATE_SCRIPT],
    {
      cwd,
      env: {
        ...process.env,
        DIRECT_WRITES_REGISTRY_PATH: registryPath,
        DIRECT_WRITES_SCAN_ROOT: scanRoot,
      },
      encoding: "utf8",
    }
  );
}

test("direct-writes gate passes when writer is allowlisted", async () => {
  const fixture = await setupFixture({
    "tmp_gate/config/state_write_registry.json": JSON.stringify({
      version: "1.0.0",
      updatedAt: "2026-02-26",
      stateFiles: ["mood_state.json"],
      domainFileMap: { mood: "mood_state.json" },
      allowedWriters: ["tmp_gate/packages/core/src/allowed.ts"],
    }, null, 2),
    "tmp_gate/packages/core/src/allowed.ts": `
      import { writeFile } from "node:fs/promises";
      await writeFile("mood_state.json", "{}");
    `,
  });

  try {
    const result = runGate({
      cwd: fixture,
      registryPath: "tmp_gate/config/state_write_registry.json",
      scanRoot: "tmp_gate/packages/core/src",
    });
    assert.equal(result.status, 0);
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});

test("direct-writes gate fails for unauthorized writer", async () => {
  const fixture = await setupFixture({
    "tmp_gate/config/state_write_registry.json": JSON.stringify({
      version: "1.0.0",
      updatedAt: "2026-02-26",
      stateFiles: ["goals.json"],
      domainFileMap: { goals: "goals.json" },
      allowedWriters: ["tmp_gate/packages/core/src/allowed.ts"],
    }, null, 2),
    "tmp_gate/packages/core/src/other.ts": `
      import { writeFile } from "node:fs/promises";
      await writeFile("goals.json", "{}");
    `,
  });

  try {
    const result = runGate({
      cwd: fixture,
      registryPath: "tmp_gate/config/state_write_registry.json",
      scanRoot: "tmp_gate/packages/core/src",
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /may write to goals\.json/);
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});

test("direct-writes gate fails when registry is incomplete", async () => {
  const fixture = await setupFixture({
    "tmp_gate/config/state_write_registry.json": JSON.stringify({
      version: "1.0.0",
      updatedAt: "2026-02-26",
      stateFiles: ["mood_state.json"],
      domainFileMap: {},
      allowedWriters: ["tmp_gate/packages/core/src/allowed.ts"],
    }, null, 2),
    "tmp_gate/packages/core/src/allowed.ts": `
      import { writeFile } from "node:fs/promises";
      await writeFile("mood_state.json", "{}");
    `,
  });

  try {
    const result = runGate({
      cwd: fixture,
      registryPath: "tmp_gate/config/state_write_registry.json",
      scanRoot: "tmp_gate/packages/core/src",
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /invalid state write registry/);
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});
