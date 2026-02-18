import { recallMemoriesWithTrace } from "@soulseed/core";
import type { RecallPipelineResult } from "@soulseed/core";

export interface MemorySearchResult {
  query: string;
  count: number;
  results: Array<{
    id: string;
    source: string;
    content: string;
  }>;
  traceId: string;
  budget: {
    injectMax: number;
    injected: number;
    injectedChars: number;
  };
}

export async function runMemorySearchTool(
  personaPath: string,
  query: string,
  maxResults = 8
): Promise<MemorySearchResult> {
  const clampedMax = Math.min(Math.max(1, maxResults), 50);
  const result: RecallPipelineResult = await recallMemoriesWithTrace(personaPath, query, {
    budget: { injectMax: clampedMax }
  });

  const results = result.memoryBlocks.map((block) => ({
    id: block.id,
    source: block.source,
    content: block.content
  }));

  return {
    query,
    count: results.length,
    results,
    traceId: result.traceId,
    budget: {
      injectMax: clampedMax,
      injected: result.trace.budget.injected,
      injectedChars: result.trace.budget.injectedChars
    }
  };
}
