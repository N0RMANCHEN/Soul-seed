# Persona Package Layout Specification (v0.4)

> **单一真相源（Single Source of Truth）**：本文档为 Persona Package 目录结构的唯一规范定义。其他文档（README、AGENT、plans）仅引用本文档并简述，不得复制完整结构清单。  
> **Task**: H/P1-4 — Persona Package v0.4 Layout & Rollback

---

## 1. Canonical Directory Structure

```
<Name>.soulseedpersona/
├── manifest.json              # v0.4: package metadata + schemaVersion (optional)
├── persona.json              # id, displayName, schemaVersion, paths, initProfile
├── identity.json             # 身份锚点（personaId 永不变）
├── constitution.json         # 使命/价值/边界/承诺
├── worldview.json            # 世界观种子
├── habits.json               # 习惯与表达风格
├── user_profile.json         # 用户称呼/语言偏好
├── pinned.json               # Pinned Memory
├── voice_profile.json        # 语气偏好
├── relationship_state.json   # 关系状态
├── cognition_state.json      # 认知状态
├── mood_state.json           # 情绪状态
├── genome.json               # 基因/天赋（Phase F/H）
├── epigenetics.json          # 表观学习（Phase F/H）
├── interests.json            # 兴趣分布（Phase D P3-0）
├── topic_state.json          # 话题状态与线程（Phase J P0-0）
├── social_graph.json         # 社交关系图谱
├── autobiography.json        # 自传体叙事
├── self_reflection.json      # 周期自我反思
├── temporal_landmarks.json   # 时间地标
├── soul_lineage.json         # 繁衍血脉
├── life.log.jsonl            # append-only 事件流（不可篡改）
├── memory.db                 # SQLite 四状态记忆库
├── summaries/
│   ├── working_set.json
│   ├── consolidated.json
│   └── life_archive.jsonl     # life.log 轮换归档
├── snapshots/                # v0.4: migration checkpoints
│   └── snap_<timestamp>.json
├── migration_log.jsonl       # v0.4: upgrade/rollback history
└── attachments/              # 附件引用（二进制不进 JSON）
```

---

## 2. manifest.json Schema (v0.4)

Optional. When present, enables v0.4 PackageLoader with validation and graceful missing-file handling.

```json
{
  "schemaVersion": "0.4.0",
  "personaId": "string",
  "compatMode": "legacy" | "full",
  "createdAt": "ISO8601",
  "lastMigratedAt": "ISO8601",
  "checksum": "string",
  "files": {
    "[filename]": {
      "schemaVersion": "string",
      "updatedAt": "ISO8601"
    }
  }
}
```

---

## 3. migration_log.jsonl Format

Each line is a JSON object:

```json
{
  "at": "ISO8601",
  "from": "legacy" | "full",
  "to": "legacy" | "full",
  "reason": "string",
  "snapshotId": "string",
  "rollbackAvailable": "boolean"
}
```

---

## 4. Snapshot Format

`snapshots/snap_<timestamp>.json`:

```json
{
  "snapshotId": "snap_<timestamp>",
  "createdAt": "ISO8601",
  "files": {
    "persona.json": { ... },
    "genome.json": { ... },
    ...
  }
}
```

---

## 5. Rollback Behavior

- `rollbackToSnapshot(snapshotId)`: restore all state files from snapshot; delete `genome.json` (revert to legacy); append rollback event to `migration_log.jsonl`.
- Rollback **never** deletes `life.log.jsonl`, `migration_log.jsonl`, or any audit history.

---

## 6. Missing/Corrupt File Handling

- **Required**: `persona.json` — package fails to load if missing or invalid.
- **Optional**: All other state files — missing or corrupt → load with defaults, log warning.
