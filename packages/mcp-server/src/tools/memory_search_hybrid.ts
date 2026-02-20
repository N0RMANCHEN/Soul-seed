import { searchMemoriesHybrid } from "@soulseed/core";

export interface MemorySearchHybridResult {
  query: string;
  count: number;
  traceId: string;
  selectedIds: string[];
  results: Array<{
    id: string;
    content: string;
    memoryType: string;
    state: string;
    salience: number;
    score: number;
    candidateSource?: string;
    ftsScore: number;
    vectorScore: number;
    hybridScore: number;
  }>;
  trace?: unknown;
}

export async function runMemorySearchHybridTool(
  personaPath: string,
  query: string,
  maxResults = 12,
  debugTrace = false
): Promise<MemorySearchHybridResult> {
  const clampedMax = Math.min(Math.max(1, maxResults), 100);
  const result = await searchMemoriesHybrid(personaPath, query, {
    maxResults: clampedMax
  });

  return {
    query,
    count: result.items.length,
    traceId: result.traceId,
    selectedIds: result.selectedIds,
    results: result.items,
    ...(debugTrace ? { trace: result.trace } : {})
  };
}
