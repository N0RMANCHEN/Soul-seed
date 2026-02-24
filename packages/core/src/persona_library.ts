import { listLibraryBlocks } from "./persona.js";
import type { PersonaLibraryBlock } from "./types.js";

export interface PersonaLibrarySearchResult {
  items: Array<{
    block: PersonaLibraryBlock;
    score: number;
    matchedTokens: string[];
  }>;
  dropped: number;
}

export function tokenizeQuery(query: string): string[] {
  return Array.from(new Set(query.toLowerCase().split(/[^\p{L}\p{N}_]+/u).filter((x) => x.length >= 2))).slice(0, 12);
}

export async function searchPersonaLibrary(
  rootPath: string,
  query: string,
  options?: { limit?: number }
): Promise<PersonaLibrarySearchResult> {
  const limit = Math.max(1, Math.min(8, options?.limit ?? 3));
  const tokens = tokenizeQuery(query);
  const blocks = await listLibraryBlocks(rootPath);
  if (tokens.length === 0 || blocks.length === 0) {
    return { items: [], dropped: 0 };
  }

  const scored = blocks
    .map((block) => {
      const hay = `${block.title}\n${block.content}\n${(block.tags ?? []).join(" ")}`.toLowerCase();
      const matchedTokens = tokens.filter((t) => hay.includes(t));
      const score = matchedTokens.length / tokens.length;
      return { block, score, matchedTokens };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  const kept = scored.slice(0, limit);
  return { items: kept, dropped: Math.max(0, scored.length - kept.length) };
}

export interface LibraryInjectionItem {
  id: string;
  title: string;
  content: string;
  score: number;
  dropReason?: "inject_item_budget" | "inject_char_budget";
}

export function buildLibraryInjection(
  result: PersonaLibrarySearchResult,
  options?: { injectMax?: number; injectCharMax?: number }
): { items: LibraryInjectionItem[]; budgetUsed: number; dropped: number } {
  const injectMax = Math.max(1, Math.min(8, options?.injectMax ?? 3));
  const injectCharMax = Math.max(200, Math.min(4000, options?.injectCharMax ?? 900));
  const out: LibraryInjectionItem[] = [];
  let used = 0;
  let dropped = result.dropped;

  for (const item of result.items) {
    if (out.length >= injectMax) {
      dropped += 1;
      continue;
    }
    const rendered = `[library:${item.block.title}] ${item.block.content}`;
    if (used + rendered.length > injectCharMax) {
      dropped += 1;
      continue;
    }
    out.push({
      id: item.block.id,
      title: item.block.title,
      content: item.block.content,
      score: Number(item.score.toFixed(4))
    });
    used += rendered.length;
  }

  return { items: out, budgetUsed: used, dropped };
}
