# Hb-2-1 — Persona Package v0.4 Layout & Rollback

> **Phase**: Hb — Mind Model State Modules  
> **Subplan**: Hb-2-1 (Persona Package)  
> **Parent**: `doc/plans/Hb-2-Package-Compat.md`  
> **Tasks**: 1 (H/P1-4)  
> **Status**: `done`（Phase 级，进度以 Roadmap 为准）  
> **Progress**: 以 `doc/Roadmap.md` 为准（本计划仅描述 scope，不做逐任务快照）  
> **Canonical layout**: 完整结构定义见 `doc/Persona-Package-Layout.md`（单一真相源）  
> **Source**: `doc/Roadmap.md`, `04-Archive.md` §15, spec/22, extra/45, extra/52

---

## 1. Objective

Standardize Persona Package file layout, metadata conventions, migration snapshot format, rollback entry points, and integrity signatures for all state files introduced in Phase H.

---

## 2. Task Detail

### 2.1 H/P1-4 — Persona Package v0.4 Layout & Rollback

**Objective**: Canonical directory structure; manifest; migration snapshots; rollback; validation.

#### Package Layout Specification

> **单一真相源**：完整目录结构见 `doc/Persona-Package-Layout.md`。以下为任务执行时的简化示意。

#### Manifest Schema

```json
{
  "schemaVersion": "0.4.0",
  "personaId": "string",
  "compatMode": "legacy" | "full",
  "createdAt": "string",
  "lastMigratedAt": "string",
  "checksum": "string",
  "files": { "[filename]": { "schemaVersion": "string", "updatedAt": "string" } }
}
```

#### Key Deliverables

| Artifact | Description |
|----------|-------------|
| manifest.json schema | Package metadata, file registry |
| Package layout spec | In-code or schema document |
| PackageLoader | Validates, loads; handles missing files gracefully |
| PackageSnapshotter | Creates/restores snapshots |
| MigrationLogger | Records upgrade/rollback events |
| PackageValidator | Integrity checks, schema version checks |

#### Migration Snapshots

- Before legacy→full upgrade: snapshot all state files into `snapshots/`.
- Snapshot = single JSON bundle of all current state.
- migration_log.jsonl: `{ at, from, to, reason, snapshotId, rollbackAvailable }`.

#### Rollback Entry Point

- `rollbackToSnapshot(snapshotId)`: restore all state files; delete genome.json (revert to legacy); log rollback event.
- Rollback preserves traces (never deletes audit history).

#### File Validation

- Each state file: schemaVersion, updatedAt.
- Package loader validates against declared schema version.
- Missing/corrupt: load with defaults, log warning.

---

## 3. DoD

- Cross-version load: package v0.3 → loaded by v0.4 code → no errors; missing files get defaults.
- Snapshot/restore cycle: create → modify → rollback → state matches snapshot.
- Corrupt file handling: corrupt one file → package loads with defaults + warning.
- Migration log: upgrade → entry with all required fields.

---

## 4. Rollback

Preserve old layout reader alongside new one; feature flag to switch.

---

## 5. Storage / Schema Gate (contributing_ai.md §5.3)

- Package layout defines file locations; each state file must have schemaVersion.
- Migration: compat migration (H/P0-2) creates manifest; initPersonaPackage creates files with defaults.
- Rollback: preserve old layout reader; feature flag for v0.4 loader.

---

## 6. Integration Points

- All state modules (H/P1-0..3, H/P1-5): state files live in package
- Compat & Migration (H/P0-2): genome auto-default for legacy
- Compat Constants (H/P0-3): calibration values referenced by manifest

---

## 7. Exit Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| E1 | Cross-version load | v0.3 package → v0.4 loader → no errors |
| E2 | Snapshot/restore | Create → modify → rollback → state matches |
| E3 | Corrupt handling | One corrupt file → defaults + warning |
| E4 | Migration log | Upgrade → complete entry |
