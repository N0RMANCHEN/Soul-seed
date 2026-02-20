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

test("doctor reports invalid constitution deny rule", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-doctor-constitution-deny-"));
  const personaPath = path.join(tmpDir, "Aster.soulseedpersona");

  await initPersonaPackage(personaPath, "Aster");
  await writeFile(
    path.join(personaPath, "constitution.json"),
    JSON.stringify(
      {
        values: ["honesty", "helpfulness", "continuity"],
        boundaries: ["deny:", "no fabricated facts"],
        mission: "Be a consistent long-lived self-determined persona."
      },
      null,
      2
    ) + "\n",
    "utf8"
  );

  const result = await doctorPersona(personaPath);
  assert.equal(result.ok, false);
  assert.equal(result.issues.some((item) => item.code === "invalid_deny_rule"), true);
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

test("doctor reports missing archive segment for archived_ref memory", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-doctor-archive-ref-"));
  const personaPath = path.join(tmpDir, "Aster.soulseedpersona");
  await initPersonaPackage(personaPath, "Aster");

  execFileSync("sqlite3", [
    path.join(personaPath, "memory.db"),
    [
      "INSERT INTO memories (id, memory_type, content, salience, state, activation_count, last_activated_at, emotion_score, narrative_score, credibility_score, origin_role, evidence_level, excluded_from_recall, reconsolidation_count, source_event_hash, created_at, updated_at, deleted_at)",
      "VALUES (",
      "'arch-ref-1',",
      "'episodic',",
      "'[archived_ref] segment=memory_archive:209901:missing id=arch-ref-1 checksum=deadbeef summary=test',",
      "0.1,",
      "'archive',",
      "1,",
      "'2026-01-01T00:00:00.000Z',",
      "0.2,",
      "0.2,",
      "0.9,",
      "'system',",
      "'derived',",
      "1,",
      "0,",
      "'seed:arch-ref-1',",
      "'2026-01-01T00:00:00.000Z',",
      "'2026-01-01T00:00:00.000Z',",
      "NULL",
      ");"
    ].join(" ")
  ]);

  const result = await doctorPersona(personaPath);
  assert.equal(result.ok, false);
  assert.equal(result.issues.some((item) => item.code === "archive_segment_missing"), true);
});

test("doctor reports orphan source_event_hash rows", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-doctor-orphan-source-hash-"));
  const personaPath = path.join(tmpDir, "Aster.soulseedpersona");
  await initPersonaPackage(personaPath, "Aster");

  execFileSync("sqlite3", [
    path.join(personaPath, "memory.db"),
    [
      "INSERT INTO memories (id, memory_type, content, salience, state, activation_count, last_activated_at, emotion_score, narrative_score, credibility_score, origin_role, evidence_level, excluded_from_recall, reconsolidation_count, source_event_hash, created_at, updated_at, deleted_at)",
      "VALUES ('orphan-src-1','episodic','orphan source hash sample',0.5,'warm',1,'2026-02-20T00:00:00.000Z',0.2,0.2,0.9,'assistant','derived',0,0,'missing-life-event-hash','2026-02-20T00:00:00.000Z','2026-02-20T00:00:00.000Z',NULL);"
    ].join(" ")
  ]);

  const result = await doctorPersona(personaPath);
  assert.equal(result.ok, false);
  assert.equal(result.issues.some((item) => item.code === "orphan_memory_source_event_hash"), true);
});

test("doctor reports invalid embedding rows and stale hash mismatch", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-doctor-embedding-health-"));
  const personaPath = path.join(tmpDir, "Aster.soulseedpersona");
  await initPersonaPackage(personaPath, "Aster");

  execFileSync("sqlite3", [
    path.join(personaPath, "memory.db"),
    [
      "INSERT INTO memories (id, memory_type, content, salience, state, activation_count, last_activated_at, emotion_score, narrative_score, credibility_score, origin_role, evidence_level, excluded_from_recall, reconsolidation_count, source_event_hash, created_at, updated_at, deleted_at)",
      "VALUES ('emb-health-1','semantic','embedding health sample',0.6,'warm',1,'2026-02-20T00:00:00.000Z',0.2,0.3,0.95,'user','verified',0,0,'seed:emb-health-1','2026-02-20T00:00:00.000Z','2026-02-20T00:00:00.000Z',NULL);"
    ].join(" ")
  ]);

  execFileSync("sqlite3", [
    path.join(personaPath, "memory.db"),
    [
      "INSERT INTO memory_embeddings (memory_id, provider, model, dim, vector_json, content_hash, updated_at)",
      "VALUES ('emb-health-1','local','local-hash-v1',3,'[0.1,0.2]','deadbeef','2026-02-20T00:00:00.000Z');"
    ].join(" ")
  ]);

  execFileSync("sqlite3", [
    path.join(personaPath, "memory.db"),
    [
      "INSERT INTO memory_embeddings (memory_id, provider, model, dim, vector_json, content_hash, updated_at)",
      "VALUES ('missing-memory-id','local','local-hash-v1',2,'[0.1,0.2]','deadbeef','2026-02-20T00:00:00.000Z');"
    ].join(" ")
  ]);

  const result = await doctorPersona(personaPath);
  assert.equal(result.ok, false);
  assert.equal(result.issues.some((item) => item.code === "memory_embedding_orphan_row"), true);
  assert.equal(result.issues.some((item) => item.code === "memory_embedding_dim_mismatch"), true);
  assert.equal(result.issues.some((item) => item.code === "memory_embedding_content_hash_mismatch"), true);
});

test("doctor reports invalid recall trace payload json", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-doctor-recall-trace-health-"));
  const personaPath = path.join(tmpDir, "Aster.soulseedpersona");
  await initPersonaPackage(personaPath, "Aster");

  execFileSync("sqlite3", [
    path.join(personaPath, "memory.db"),
    [
      "INSERT INTO recall_traces (id, query, selected_ids_json, scores_json, budget_json, created_at)",
      "VALUES ('bad-trace-1','query','not-json','{}','{}','bad-date');"
    ].join(" ")
  ]);

  const result = await doctorPersona(personaPath);
  assert.equal(result.ok, false);
  assert.equal(result.issues.some((item) => item.code === "invalid_recall_trace_payload"), true);
  assert.equal(result.issues.some((item) => item.code === "invalid_recall_trace_created_at"), true);
});

test("doctor detects invalid cognition_state.json", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-doctor-cognition-"));
  const personaPath = path.join(tmpDir, "Aster.soulseedpersona");
  await initPersonaPackage(personaPath, "Aster");

  // Write an invalid cognition_state: instinctBias out of range
  await writeFile(
    path.join(personaPath, "cognition_state.json"),
    JSON.stringify({
      instinctBias: 1.5,
      epistemicStance: "balanced",
      toolPreference: "auto",
      updatedAt: new Date().toISOString()
    }, null, 2) + "\n",
    "utf8"
  );

  const result = await doctorPersona(personaPath);
  assert.equal(result.ok, false);
  assert.equal(result.issues.some((item) => item.code === "invalid_cognition_state"), true);
});

test("doctor accepts valid cognition_state.json", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-doctor-cognition-valid-"));
  const personaPath = path.join(tmpDir, "Aster.soulseedpersona");
  await initPersonaPackage(personaPath, "Aster");

  // cognition_state.json is already initialized by initPersonaPackage with valid defaults
  const result = await doctorPersona(personaPath);
  assert.equal(result.issues.some((item) => item.code === "invalid_cognition_state"), false);
});

test("doctor reports missing cognition_state.json", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-doctor-cognition-missing-"));
  const personaPath = path.join(tmpDir, "Aster.soulseedpersona");
  await initPersonaPackage(personaPath, "Aster");
  await rm(path.join(personaPath, "cognition_state.json"));

  const result = await doctorPersona(personaPath);
  assert.equal(result.ok, false);
  assert.equal(result.issues.some((item) => item.code === "missing_file" && item.path === "cognition_state.json"), true);
});
