import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";

import { appendLifeEvent, doctorPersona, initPersonaPackage } from "../dist/index.js";

test("doctor reports missing files", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-doctor-test-"));
  const personaPath = path.join(tmpDir, "Aster.soulseedpersona");

  await initPersonaPackage(personaPath, "Aster");
  await rm(path.join(personaPath, "constitution.json"));

  const result = await doctorPersona(personaPath);
  assert.equal(result.ok, false);
  assert.equal(result.issues[0].code, "missing_file");
});

test("doctor reports mission drift as warning", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-doctor-test-"));
  const personaPath = path.join(tmpDir, "Aster.soulseedpersona");

  await initPersonaPackage(personaPath, "Aster");
  await writeFile(
    path.join(personaPath, "constitution.json"),
    JSON.stringify(
      {
        values: ["honesty", "helpfulness", "continuity"],
        boundaries: ["no fabricated facts", "respect user constraints"],
        mission: "Be a consistent long-lived assistant."
      },
      null,
      2
    ) + "\n",
    "utf8"
  );

  const result = await doctorPersona(personaPath);
  const issue = result.issues.find((item) => item.code === "mission_drift");
  assert.ok(issue);
  assert.equal(issue.severity, "warning");
});

test("doctor reports missing memory.db", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-doctor-memory-db-missing-"));
  const personaPath = path.join(tmpDir, "Aster.soulseedpersona");

  await initPersonaPackage(personaPath, "Aster");
  await rm(path.join(personaPath, "memory.db"));

  const result = await doctorPersona(personaPath);
  assert.equal(result.ok, false);
  assert.equal(result.issues.some((item) => item.code === "missing_file" && item.path === "memory.db"), true);
});

test("doctor reports memory schema mismatch", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-doctor-memory-schema-"));
  const personaPath = path.join(tmpDir, "Aster.soulseedpersona");

  await initPersonaPackage(personaPath, "Aster");
  execFileSync("sqlite3", [path.join(personaPath, "memory.db"), "PRAGMA user_version = 999;"]);

  const result = await doctorPersona(personaPath);
  assert.equal(result.ok, false);
  assert.equal(result.issues.some((item) => item.code === "memory_schema_version_mismatch"), true);
});

test("doctor reports missing required memory tables", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-doctor-memory-tables-"));
  const personaPath = path.join(tmpDir, "Aster.soulseedpersona");

  await initPersonaPackage(personaPath, "Aster");
  execFileSync("sqlite3", [path.join(personaPath, "memory.db"), "DROP TABLE archive_segments;"]);

  const result = await doctorPersona(personaPath);
  assert.equal(result.ok, false);
  assert.equal(result.issues.some((item) => item.code === "memory_schema_missing_tables"), true);
});

test("doctor reports invalid memory.db field ranges", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-doctor-memory-field-ranges-"));
  const personaPath = path.join(tmpDir, "Aster.soulseedpersona");

  await initPersonaPackage(personaPath, "Aster");
  execFileSync("sqlite3", [
    path.join(personaPath, "memory.db"),
    [
      "INSERT INTO memories (id, memory_type, content, salience, state, activation_count, last_activated_at, emotion_score, narrative_score, credibility_score, excluded_from_recall, reconsolidation_count, source_event_hash, created_at, updated_at, deleted_at)",
      "VALUES ('bad-memory','episodic','bad data',0.5,'warm',0,'not-a-date',0.2,0.2,2.2,3,0,'hash','2026-02-17T00:00:00.000Z','2026-02-17T00:00:00.000Z',NULL);"
    ].join(" ")
  ]);

  const result = await doctorPersona(personaPath);
  assert.equal(result.ok, false);
  assert.equal(result.issues.some((item) => item.code === "invalid_memory_credibility_score"), true);
  assert.equal(result.issues.some((item) => item.code === "invalid_memory_excluded_flag"), true);
  assert.equal(result.issues.some((item) => item.code === "invalid_memory_activation_count"), true);
  assert.equal(result.issues.some((item) => item.code === "invalid_memory_last_activated_at"), true);
});

test("doctor reports invalid pinned schema", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-doctor-pinned-invalid-"));
  const personaPath = path.join(tmpDir, "Aster.soulseedpersona");
  await initPersonaPackage(personaPath, "Aster");

  await writeFile(
    path.join(personaPath, "pinned.json"),
    JSON.stringify({ memories: new Array(40).fill("x") }, null, 2) + "\n",
    "utf8"
  );

  const result = await doctorPersona(personaPath);
  assert.equal(result.issues.some((item) => item.code === "invalid_pinned"), true);
});

test("doctor reports contamination exclusion drift warning", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-doctor-contamination-drift-"));
  const personaPath = path.join(tmpDir, "Aster.soulseedpersona");
  await initPersonaPackage(personaPath, "Aster");

  await appendLifeEvent(personaPath, {
    type: "memory_contamination_flagged",
    payload: {
      flags: ["ungrounded_recall"],
      rewrittenText: "我不确定之前是否聊过这个细节"
    }
  });

  const result = await doctorPersona(personaPath);
  assert.equal(result.issues.some((item) => item.code === "memory_contamination_exclusion_drift"), true);
});
