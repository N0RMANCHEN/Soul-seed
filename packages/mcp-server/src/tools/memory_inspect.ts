import { ensureMemoryStore, runMemoryStoreSql } from "@soulseed/core";

function sqlText(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

export interface MemoryInspectResult {
  found: boolean;
  memory?: {
    id: string;
    memoryType: string;
    content: string;
    salience: number;
    state: string;
    activationCount: number;
    lastActivatedAt: string;
    credibilityScore: number;
    excludedFromRecall: boolean;
    createdAt: string;
    updatedAt: string;
    deletedAt: string | null;
  };
}

export async function runMemoryInspectTool(
  personaPath: string,
  id: string
): Promise<MemoryInspectResult> {
  await ensureMemoryStore(personaPath);
  const sql = `
    SELECT
      id,
      memory_type AS memoryType,
      content,
      salience,
      state,
      activation_count AS activationCount,
      last_activated_at AS lastActivatedAt,
      credibility_score AS credibilityScore,
      excluded_from_recall AS excludedFromRecall,
      created_at AS createdAt,
      updated_at AS updatedAt,
      deleted_at AS deletedAt
    FROM memories
    WHERE id = ${sqlText(id)}
    LIMIT 1;
  `;
  const raw = await runMemoryStoreSql(personaPath, sql);
  if (!raw.trim()) {
    return { found: false };
  }
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>;
      const rowId = typeof parsed.id === "string" ? parsed.id : "";
      if (!rowId) continue;
      return {
        found: true,
        memory: {
          id: rowId,
          memoryType: typeof parsed.memoryType === "string" ? parsed.memoryType : "episodic",
          content: typeof parsed.content === "string" ? parsed.content : "",
          salience: Number(parsed.salience) || 0,
          state: typeof parsed.state === "string" ? parsed.state : "warm",
          activationCount: Number(parsed.activationCount) || 0,
          lastActivatedAt: typeof parsed.lastActivatedAt === "string" ? parsed.lastActivatedAt : "",
          credibilityScore: Number(parsed.credibilityScore) || 0,
          excludedFromRecall: Number(parsed.excludedFromRecall) === 1 || parsed.excludedFromRecall === true,
          createdAt: typeof parsed.createdAt === "string" ? parsed.createdAt : "",
          updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : "",
          deletedAt: typeof parsed.deletedAt === "string" ? parsed.deletedAt : null
        }
      };
    } catch {
      continue;
    }
  }
  return { found: false };
}
