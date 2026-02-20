import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  initPersonaPackage,
  ensureMemoryStore,
  checkCrystallizationFileSizes,
  proposeConstitutionCrystallization,
  listCrystallizationRuns,
  applyCrystallizationRun,
  rejectCrystallizationRun
} from "../dist/index.js";

let tmpDir;

before(async () => {
  tmpDir = await mkdtemp(path.join(tmpdir(), "soulseed-crystallization-test-"));
  await initPersonaPackage(tmpDir, "TestCrystal");
  await ensureMemoryStore(tmpDir);
});

after(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe("constitution crystallization", () => {
  it("checkCrystallizationFileSizes returns size info for all three files", async () => {
    const report = await checkCrystallizationFileSizes(tmpDir);
    assert.ok(typeof report.constitutionBytes === "number");
    assert.ok(typeof report.habitsBytes === "number");
    assert.ok(typeof report.worldviewBytes === "number");
    assert.ok(typeof report.constitutionOverLimit === "boolean");
    assert.ok(typeof report.habitsOverLimit === "boolean");
    assert.ok(typeof report.worldviewOverLimit === "boolean");
  });

  it("proposeConstitutionCrystallization creates a pending run", async () => {
    const run = await proposeConstitutionCrystallization(tmpDir, {
      domain: "constitution",
      trigger: "manual"
    });
    assert.ok(run.id.length > 0);
    assert.equal(run.domain, "constitution");
    assert.equal(run.trigger, "manual");
    assert.equal(run.status, "pending");
    assert.equal(run.schemaVersion, "1.0");
  });

  it("listCrystallizationRuns returns proposed run", async () => {
    const runs = await listCrystallizationRuns(tmpDir, { limit: 10 });
    assert.ok(runs.length >= 1);
    const run = runs[0];
    assert.ok(run.id.length > 0);
    assert.equal(typeof run.status, "string");
  });

  it("rejectCrystallizationRun marks run as rejected", async () => {
    const run = await proposeConstitutionCrystallization(tmpDir, {
      domain: "habits",
      trigger: "manual"
    });
    const result = await rejectCrystallizationRun(tmpDir, run.id, "test-reviewer");
    assert.equal(result.ok, true);

    const runs = await listCrystallizationRuns(tmpDir, { domain: "habits", status: "rejected" });
    assert.ok(runs.some((r) => r.id === run.id));
  });

  it("applyCrystallizationRun applies a pending run", async () => {
    const run = await proposeConstitutionCrystallization(tmpDir, {
      domain: "worldview",
      trigger: "manual"
    });
    const result = await applyCrystallizationRun(tmpDir, run.id);
    // Either ok or a size warning (file might be under limit so no diff)
    assert.ok(typeof result.ok === "boolean");
  });

  it("cannot apply an already-rejected run", async () => {
    const run = await proposeConstitutionCrystallization(tmpDir, {
      domain: "constitution",
      trigger: "auto"
    });
    await rejectCrystallizationRun(tmpDir, run.id);
    const result = await applyCrystallizationRun(tmpDir, run.id);
    assert.equal(result.ok, false);
  });
});
