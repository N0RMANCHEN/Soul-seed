import { existsSync } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";

export const MEMORY_DB_FILENAME = "memory.db";
export const MEMORY_SCHEMA_VERSION = 7;

const REQUIRED_MEMORY_TABLES = [
  "memories",
  "memory_edges",
  "recall_traces",
  "archive_segments",
  "memories_fts",
  "memory_embeddings",
  "memory_conflicts",
  "memory_consolidation_runs",
  "external_knowledge_candidates",
  "external_knowledge_entries",
  "persona_judgments"
] as const;

export interface MemoryStoreInspection {
  exists: boolean;
  schemaVersion: number | null;
  missingTables: string[];
}

export async function ensureMemoryStore(rootPath: string): Promise<void> {
  const dbPath = path.join(rootPath, MEMORY_DB_FILENAME);
  const currentVersion = await getUserVersion(dbPath);
  if (currentVersion > MEMORY_SCHEMA_VERSION) {
    throw new Error(
      `memory.db schema version ${currentVersion} is newer than supported ${MEMORY_SCHEMA_VERSION}`
    );
  }
  if (currentVersion < 1) {
    await runSqlite(
      dbPath,
      `
      BEGIN;
      CREATE TABLE IF NOT EXISTS memories (
        id TEXT PRIMARY KEY,
        memory_type TEXT NOT NULL,
        content TEXT NOT NULL,
        salience REAL NOT NULL DEFAULT 0,
        state TEXT NOT NULL DEFAULT 'warm',
        activation_count INTEGER NOT NULL DEFAULT 1,
        last_activated_at TEXT NOT NULL DEFAULT '1970-01-01T00:00:00.000Z',
        emotion_score REAL NOT NULL DEFAULT 0.2,
        narrative_score REAL NOT NULL DEFAULT 0.2,
        credibility_score REAL NOT NULL DEFAULT 1.0,
        origin_role TEXT NOT NULL DEFAULT 'system',
        evidence_level TEXT NOT NULL DEFAULT 'derived',
        excluded_from_recall INTEGER NOT NULL DEFAULT 0,
        reconsolidation_count INTEGER NOT NULL DEFAULT 0,
        source_event_hash TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_memories_type_state ON memories(memory_type, state);
      CREATE INDEX IF NOT EXISTS idx_memories_source_event_hash ON memories(source_event_hash);
      CREATE INDEX IF NOT EXISTS idx_memories_recall_filter ON memories(deleted_at, excluded_from_recall, state);

      CREATE TABLE IF NOT EXISTS memory_edges (
        id TEXT PRIMARY KEY,
        from_memory_id TEXT NOT NULL,
        to_memory_id TEXT NOT NULL,
        edge_type TEXT NOT NULL,
        weight REAL NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        FOREIGN KEY (from_memory_id) REFERENCES memories(id),
        FOREIGN KEY (to_memory_id) REFERENCES memories(id)
      );
      CREATE INDEX IF NOT EXISTS idx_memory_edges_from ON memory_edges(from_memory_id);
      CREATE INDEX IF NOT EXISTS idx_memory_edges_to ON memory_edges(to_memory_id);

      CREATE TABLE IF NOT EXISTS recall_traces (
        id TEXT PRIMARY KEY,
        query TEXT NOT NULL,
        selected_ids_json TEXT NOT NULL,
        scores_json TEXT NOT NULL,
        budget_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS archive_segments (
        id TEXT PRIMARY KEY,
        segment_key TEXT NOT NULL UNIQUE,
        summary TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        checksum TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS memory_embeddings (
        memory_id TEXT PRIMARY KEY,
        provider TEXT NOT NULL,
        model TEXT NOT NULL,
        dim INTEGER NOT NULL,
        vector_json TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (memory_id) REFERENCES memories(id)
      );
      CREATE INDEX IF NOT EXISTS idx_memory_embeddings_updated ON memory_embeddings(updated_at);

      CREATE TABLE IF NOT EXISTS memory_conflicts (
        id TEXT PRIMARY KEY,
        conflict_key TEXT NOT NULL,
        winner_memory_id TEXT NOT NULL,
        loser_memory_ids_json TEXT NOT NULL,
        resolution_policy TEXT NOT NULL,
        resolved_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_memory_conflicts_key ON memory_conflicts(conflict_key, resolved_at);

      CREATE TABLE IF NOT EXISTS memory_consolidation_runs (
        id TEXT PRIMARY KEY,
        trigger TEXT NOT NULL,
        mode TEXT NOT NULL,
        stats_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_memory_consolidation_runs_created ON memory_consolidation_runs(created_at);

      CREATE TABLE IF NOT EXISTS external_knowledge_candidates (
        id TEXT PRIMARY KEY,
        source_type TEXT NOT NULL,
        source_uri TEXT NOT NULL,
        content TEXT NOT NULL,
        summary TEXT NOT NULL,
        extracted_at TEXT NOT NULL,
        confidence REAL NOT NULL DEFAULT 0.6,
        status TEXT NOT NULL DEFAULT 'pending',
        reviewer TEXT,
        reviewed_at TEXT,
        review_reason TEXT,
        checksum TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_external_knowledge_candidates_status ON external_knowledge_candidates(status, extracted_at);

      CREATE TABLE IF NOT EXISTS external_knowledge_entries (
        id TEXT PRIMARY KEY,
        candidate_id TEXT NOT NULL,
        source_type TEXT NOT NULL,
        source_uri TEXT NOT NULL,
        content TEXT NOT NULL,
        summary TEXT NOT NULL,
        confidence REAL NOT NULL DEFAULT 0.6,
        extracted_at TEXT NOT NULL,
        approved_at TEXT NOT NULL,
        checksum TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (candidate_id) REFERENCES external_knowledge_candidates(id)
      );
      CREATE INDEX IF NOT EXISTS idx_external_knowledge_entries_source ON external_knowledge_entries(source_uri, approved_at);

      CREATE TABLE IF NOT EXISTS persona_judgments (
        id TEXT PRIMARY KEY,
        subject_ref TEXT NOT NULL,
        label TEXT NOT NULL,
        confidence REAL NOT NULL DEFAULT 0.5,
        rationale TEXT NOT NULL,
        evidence_refs_json TEXT NOT NULL DEFAULT '[]',
        version INTEGER NOT NULL,
        supersedes_version INTEGER,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_persona_judgments_subject_active ON persona_judgments(subject_ref, is_active, version);

      CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
        memory_id UNINDEXED,
        content,
        tokenize = 'unicode61'
      );
      CREATE TRIGGER IF NOT EXISTS memories_ai AFTER INSERT ON memories BEGIN
        INSERT INTO memories_fts(memory_id, content)
        SELECT NEW.id, NEW.content
        WHERE NEW.deleted_at IS NULL AND COALESCE(NEW.excluded_from_recall, 0) = 0;
      END;
      CREATE TRIGGER IF NOT EXISTS memories_au AFTER UPDATE ON memories BEGIN
        DELETE FROM memories_fts WHERE memory_id = OLD.id;
        INSERT INTO memories_fts(memory_id, content)
        SELECT NEW.id, NEW.content
        WHERE NEW.deleted_at IS NULL AND COALESCE(NEW.excluded_from_recall, 0) = 0;
      END;
      CREATE TRIGGER IF NOT EXISTS memories_ad AFTER DELETE ON memories BEGIN
        DELETE FROM memories_fts WHERE memory_id = OLD.id;
      END;
      INSERT INTO memories_fts(memory_id, content)
      SELECT id, content
      FROM memories
      WHERE deleted_at IS NULL AND COALESCE(excluded_from_recall, 0) = 0;

      PRAGMA user_version = 7;
      COMMIT;
      `
    );
    return;
  }

  if (currentVersion < 2) {
    await migrateMemoryStoreToV2(dbPath);
  }
  if (currentVersion < 3) {
    await migrateMemoryStoreToV3(dbPath);
  }
  if (currentVersion < 4) {
    await migrateMemoryStoreToV4(dbPath);
  }
  if (currentVersion < 5) {
    await migrateMemoryStoreToV5(dbPath);
  }
  if (currentVersion < 6) {
    await migrateMemoryStoreToV6(dbPath);
  }
  if (currentVersion < 7) {
    await migrateMemoryStoreToV7(dbPath);
  }
}

export async function inspectMemoryStore(rootPath: string): Promise<MemoryStoreInspection> {
  const dbPath = path.join(rootPath, MEMORY_DB_FILENAME);
  if (!existsSync(dbPath)) {
    return {
      exists: false,
      schemaVersion: null,
      missingTables: [...REQUIRED_MEMORY_TABLES]
    };
  }

  const schemaVersion = await getUserVersion(dbPath);
  const tableRows = await runSqlite(
    dbPath,
    "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('memories','memory_edges','recall_traces','archive_segments','memories_fts','memory_embeddings','memory_conflicts','memory_consolidation_runs','external_knowledge_candidates','external_knowledge_entries','persona_judgments') ORDER BY name;"
  );
  const existingTables = new Set(tableRows.split("\n").map((line) => line.trim()).filter(Boolean));
  const missingTables = REQUIRED_MEMORY_TABLES.filter((table) => !existingTables.has(table));
  return {
    exists: true,
    schemaVersion,
    missingTables
  };
}

export async function runMemoryStoreSql(rootPath: string, sql: string): Promise<string> {
  const dbPath = path.join(rootPath, MEMORY_DB_FILENAME);
  return runSqlite(dbPath, sql);
}

async function getUserVersion(dbPath: string): Promise<number> {
  const out = await runSqlite(dbPath, "PRAGMA user_version;");
  const parsed = Number.parseInt(out.trim(), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function migrateMemoryStoreToV2(dbPath: string): Promise<void> {
  const columns = await getTableColumns(dbPath, "memories");
  const alterSql: string[] = [];

  if (!columns.has("activation_count")) {
    alterSql.push("ALTER TABLE memories ADD COLUMN activation_count INTEGER NOT NULL DEFAULT 1;");
  }
  if (!columns.has("last_activated_at")) {
    alterSql.push(
      "ALTER TABLE memories ADD COLUMN last_activated_at TEXT NOT NULL DEFAULT '1970-01-01T00:00:00.000Z';"
    );
  }
  if (!columns.has("emotion_score")) {
    alterSql.push("ALTER TABLE memories ADD COLUMN emotion_score REAL NOT NULL DEFAULT 0.2;");
  }
  if (!columns.has("narrative_score")) {
    alterSql.push("ALTER TABLE memories ADD COLUMN narrative_score REAL NOT NULL DEFAULT 0.2;");
  }
  if (!columns.has("credibility_score")) {
    alterSql.push("ALTER TABLE memories ADD COLUMN credibility_score REAL NOT NULL DEFAULT 1.0;");
  }
  if (!columns.has("excluded_from_recall")) {
    alterSql.push("ALTER TABLE memories ADD COLUMN excluded_from_recall INTEGER NOT NULL DEFAULT 0;");
  }
  if (!columns.has("reconsolidation_count")) {
    alterSql.push("ALTER TABLE memories ADD COLUMN reconsolidation_count INTEGER NOT NULL DEFAULT 0;");
  }

  await runSqlite(
    dbPath,
    `
    BEGIN;
    ${alterSql.join("\n")}
    CREATE INDEX IF NOT EXISTS idx_memories_recall_filter ON memories(deleted_at, excluded_from_recall, state);
    UPDATE memories SET activation_count = COALESCE(activation_count, 1);
    UPDATE memories SET last_activated_at = COALESCE(last_activated_at, updated_at, created_at, '1970-01-01T00:00:00.000Z');
    UPDATE memories SET emotion_score = COALESCE(emotion_score, 0.2);
    UPDATE memories SET narrative_score = COALESCE(narrative_score, 0.2);
    UPDATE memories SET credibility_score = COALESCE(credibility_score, 1.0);
    UPDATE memories SET excluded_from_recall = COALESCE(excluded_from_recall, 0);
    UPDATE memories SET reconsolidation_count = COALESCE(reconsolidation_count, 0);
    PRAGMA user_version = 2;
    COMMIT;
    `
  );
}

async function migrateMemoryStoreToV3(dbPath: string): Promise<void> {
  const columns = await getTableColumns(dbPath, "memories");
  const alterSql: string[] = [];
  if (!columns.has("origin_role")) {
    alterSql.push("ALTER TABLE memories ADD COLUMN origin_role TEXT NOT NULL DEFAULT 'system';");
  }
  if (!columns.has("evidence_level")) {
    alterSql.push("ALTER TABLE memories ADD COLUMN evidence_level TEXT NOT NULL DEFAULT 'derived';");
  }

  await runSqlite(
    dbPath,
    `
    BEGIN;
    ${alterSql.join("\n")}
    UPDATE memories SET origin_role = COALESCE(origin_role, 'system');
    UPDATE memories SET evidence_level = COALESCE(evidence_level, 'derived');
    PRAGMA user_version = 3;
    COMMIT;
    `
  );
}

async function migrateMemoryStoreToV4(dbPath: string): Promise<void> {
  await runSqlite(
    dbPath,
    `
    BEGIN;
    CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
      memory_id UNINDEXED,
      content,
      tokenize = 'unicode61'
    );
    CREATE TRIGGER IF NOT EXISTS memories_ai AFTER INSERT ON memories BEGIN
      INSERT INTO memories_fts(memory_id, content)
      SELECT NEW.id, NEW.content
      WHERE NEW.deleted_at IS NULL AND COALESCE(NEW.excluded_from_recall, 0) = 0;
    END;
    CREATE TRIGGER IF NOT EXISTS memories_au AFTER UPDATE ON memories BEGIN
      DELETE FROM memories_fts WHERE memory_id = OLD.id;
      INSERT INTO memories_fts(memory_id, content)
      SELECT NEW.id, NEW.content
      WHERE NEW.deleted_at IS NULL AND COALESCE(NEW.excluded_from_recall, 0) = 0;
    END;
    CREATE TRIGGER IF NOT EXISTS memories_ad AFTER DELETE ON memories BEGIN
      DELETE FROM memories_fts WHERE memory_id = OLD.id;
    END;
    DELETE FROM memories_fts;
    INSERT INTO memories_fts(memory_id, content)
    SELECT id, content
    FROM memories
    WHERE deleted_at IS NULL AND COALESCE(excluded_from_recall, 0) = 0;
    PRAGMA user_version = 4;
    COMMIT;
    `
  );
}

async function migrateMemoryStoreToV5(dbPath: string): Promise<void> {
  await runSqlite(
    dbPath,
    `
    BEGIN;
    CREATE TABLE IF NOT EXISTS memory_embeddings (
      memory_id TEXT PRIMARY KEY,
      provider TEXT NOT NULL,
      model TEXT NOT NULL,
      dim INTEGER NOT NULL,
      vector_json TEXT NOT NULL,
      content_hash TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (memory_id) REFERENCES memories(id)
    );
    CREATE INDEX IF NOT EXISTS idx_memory_embeddings_updated ON memory_embeddings(updated_at);

    CREATE TABLE IF NOT EXISTS memory_conflicts (
      id TEXT PRIMARY KEY,
      conflict_key TEXT NOT NULL,
      winner_memory_id TEXT NOT NULL,
      loser_memory_ids_json TEXT NOT NULL,
      resolution_policy TEXT NOT NULL,
      resolved_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_memory_conflicts_key ON memory_conflicts(conflict_key, resolved_at);

    CREATE TABLE IF NOT EXISTS memory_consolidation_runs (
      id TEXT PRIMARY KEY,
      trigger TEXT NOT NULL,
      mode TEXT NOT NULL,
      stats_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_memory_consolidation_runs_created ON memory_consolidation_runs(created_at);
    PRAGMA user_version = 5;
    COMMIT;
    `
  );
}

async function migrateMemoryStoreToV6(dbPath: string): Promise<void> {
  await runSqlite(
    dbPath,
    `
    BEGIN;
    CREATE TABLE IF NOT EXISTS external_knowledge_candidates (
      id TEXT PRIMARY KEY,
      source_type TEXT NOT NULL,
      source_uri TEXT NOT NULL,
      content TEXT NOT NULL,
      summary TEXT NOT NULL,
      extracted_at TEXT NOT NULL,
      confidence REAL NOT NULL DEFAULT 0.6,
      status TEXT NOT NULL DEFAULT 'pending',
      reviewer TEXT,
      reviewed_at TEXT,
      review_reason TEXT,
      checksum TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_external_knowledge_candidates_status ON external_knowledge_candidates(status, extracted_at);

    CREATE TABLE IF NOT EXISTS external_knowledge_entries (
      id TEXT PRIMARY KEY,
      candidate_id TEXT NOT NULL,
      source_type TEXT NOT NULL,
      source_uri TEXT NOT NULL,
      content TEXT NOT NULL,
      summary TEXT NOT NULL,
      confidence REAL NOT NULL DEFAULT 0.6,
      extracted_at TEXT NOT NULL,
      approved_at TEXT NOT NULL,
      checksum TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (candidate_id) REFERENCES external_knowledge_candidates(id)
    );
    CREATE INDEX IF NOT EXISTS idx_external_knowledge_entries_source ON external_knowledge_entries(source_uri, approved_at);
    PRAGMA user_version = 6;
    COMMIT;
    `
  );
}

async function migrateMemoryStoreToV7(dbPath: string): Promise<void> {
  await runSqlite(
    dbPath,
    `
    BEGIN;
    CREATE TABLE IF NOT EXISTS persona_judgments (
      id TEXT PRIMARY KEY,
      subject_ref TEXT NOT NULL,
      label TEXT NOT NULL,
      confidence REAL NOT NULL DEFAULT 0.5,
      rationale TEXT NOT NULL,
      evidence_refs_json TEXT NOT NULL DEFAULT '[]',
      version INTEGER NOT NULL,
      supersedes_version INTEGER,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_persona_judgments_subject_active ON persona_judgments(subject_ref, is_active, version);
    PRAGMA user_version = 7;
    COMMIT;
    `
  );
}

async function getTableColumns(dbPath: string, tableName: string): Promise<Set<string>> {
  const rows = await runSqlite(dbPath, `PRAGMA table_info(${tableName});`);
  const columns = new Set<string>();
  if (!rows.trim()) {
    return columns;
  }
  for (const row of rows.split("\n")) {
    const parts = row.split("|");
    const name = parts[1]?.trim();
    if (name) {
      columns.add(name);
    }
  }
  return columns;
}

async function runSqlite(dbPath: string, sql: string): Promise<string> {
  const execFileAsync = promisify(execFile);
  try {
    const { stdout } = await execFileAsync("sqlite3", [dbPath, sql], {
      maxBuffer: 1024 * 1024
    });
    return stdout.trim();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`sqlite3 command failed: ${message}`);
  }
}
