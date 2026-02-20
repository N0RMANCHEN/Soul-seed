import { createHash } from "node:crypto";
import { ensureMemoryStore, runMemoryStoreSql } from "./memory_store.js";

export interface EmbeddingProvider {
  readonly name: string;
  readonly model: string;
  readonly dim: number;
  embed(texts: string[]): Promise<number[][]>;
}

export interface BuildEmbeddingOptions {
  provider?: "deepseek" | "local";
  batchSize?: number;
  maxRows?: number;
}

export interface BuildEmbeddingReport {
  provider: string;
  model: string;
  dim: number;
  scanned: number;
  embedded: number;
  skippedUnchanged: number;
  removedStale: number;
}

export interface VectorSearchResult {
  id: string;
  score: number;
}

export class LocalDeterministicEmbeddingProvider implements EmbeddingProvider {
  readonly name = "local";
  readonly model = "local-hash-v1";
  readonly dim = 128;

  async embed(texts: string[]): Promise<number[][]> {
    return texts.map((text) => embedTextDeterministic(text, this.dim));
  }
}

export class DeepSeekEmbeddingProvider implements EmbeddingProvider {
  readonly name = "deepseek";
  readonly model: string;
  readonly dim: number;
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor() {
    this.apiKey = process.env.DEEPSEEK_API_KEY ?? "";
    this.baseUrl = process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com/v1";
    this.model = process.env.DEEPSEEK_EMBEDDING_MODEL ?? "deepseek-embedding";
    this.dim = Number(process.env.DEEPSEEK_EMBEDDING_DIM ?? 1024);
    if (!this.apiKey) {
      throw new Error("Missing DEEPSEEK_API_KEY for embedding provider");
    }
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) {
      return [];
    }
    const res = await fetch(`${this.baseUrl}/embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.model,
        input: texts
      })
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`DeepSeek embedding request failed: ${res.status} ${text}`);
    }
    const parsed = (await res.json()) as {
      data?: Array<{ embedding?: number[] }>;
    };
    const vectors = (parsed.data ?? []).map((item) => item.embedding ?? []);
    if (vectors.length !== texts.length) {
      throw new Error("DeepSeek embedding response size mismatch");
    }
    for (const vector of vectors) {
      if (vector.length === 0) {
        throw new Error("DeepSeek embedding response contains empty vector");
      }
    }
    return vectors;
  }
}

export function createEmbeddingProvider(kind: "deepseek" | "local" = "deepseek"): EmbeddingProvider {
  if (kind === "local") {
    return new LocalDeterministicEmbeddingProvider();
  }
  try {
    return new DeepSeekEmbeddingProvider();
  } catch {
    return new LocalDeterministicEmbeddingProvider();
  }
}

export async function buildMemoryEmbeddingIndex(
  rootPath: string,
  options?: BuildEmbeddingOptions
): Promise<BuildEmbeddingReport> {
  await ensureMemoryStore(rootPath);
  const batchSize = Math.max(1, Math.min(64, Math.floor(options?.batchSize ?? 16)));
  const maxRows = Math.max(1, Math.min(10000, Math.floor(options?.maxRows ?? 4000)));
  const provider = createEmbeddingProvider(options?.provider ?? "deepseek");
  const rows = await fetchEmbeddingRows(rootPath, maxRows);
  const existing = await fetchExistingEmbeddingMeta(rootPath);

  let scanned = 0;
  let embedded = 0;
  let skippedUnchanged = 0;
  const now = new Date().toISOString();
  const upserts: string[] = [];
  const liveIds = new Set<string>();

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    scanned += batch.length;
    const needEmbed = batch.filter((row) => {
      liveIds.add(row.id);
      const hash = sha256(row.content);
      const prev = existing.get(row.id);
      if (
        prev &&
        prev.contentHash === hash &&
        prev.provider === provider.name &&
        prev.model === provider.model
      ) {
        skippedUnchanged += 1;
        return false;
      }
      return true;
    });
    if (needEmbed.length === 0) {
      continue;
    }
    const vectors = await provider.embed(needEmbed.map((row) => row.content));
    for (let j = 0; j < needEmbed.length; j += 1) {
      const row = needEmbed[j];
      const vector = vectors[j];
      if (!Array.isArray(vector) || vector.length === 0) {
        continue;
      }
      embedded += 1;
      upserts.push(
        [
          "INSERT OR REPLACE INTO memory_embeddings",
          "(memory_id, provider, model, dim, vector_json, content_hash, updated_at)",
          "VALUES",
          `(${sqlText(row.id)}, ${sqlText(provider.name)}, ${sqlText(provider.model)}, ${Math.floor(vector.length)}, ${sqlText(JSON.stringify(vector))}, ${sqlText(sha256(row.content))}, ${sqlText(now)});`
        ].join(" ")
      );
    }
  }

  const staleIds = [...existing.keys()].filter((id) => !liveIds.has(id));
  const deleteSql = staleIds
    .map((id) => `DELETE FROM memory_embeddings WHERE memory_id = ${sqlText(id)};`)
    .join("\n");

  await runMemoryStoreSql(
    rootPath,
    `
    BEGIN;
    ${upserts.join("\n")}
    ${deleteSql}
    COMMIT;
    `
  );

  return {
    provider: provider.name,
    model: provider.model,
    dim: provider.dim,
    scanned,
    embedded,
    skippedUnchanged,
    removedStale: staleIds.length
  };
}

export async function searchMemoryVectors(
  rootPath: string,
  query: string,
  options?: { maxResults?: number; provider?: "deepseek" | "local" }
): Promise<VectorSearchResult[]> {
  const maxResults = Math.max(1, Math.min(200, Math.floor(options?.maxResults ?? 64)));
  const trimmed = query.trim();
  if (!trimmed) {
    return [];
  }
  await ensureMemoryStore(rootPath);
  const targetProvider = options?.provider ?? (await inferIndexedProvider(rootPath));
  if (!targetProvider) {
    return [];
  }
  const provider = createEmbeddingProvider(targetProvider);
  const vectors = await provider.embed([trimmed]);
  const queryVector = vectors[0];
  if (!queryVector || queryVector.length === 0) {
    return [];
  }

  const raw = await runMemoryStoreSql(
    rootPath,
    [
      "SELECT json_object(",
      "'id', m.id,",
      "'vector', e.vector_json",
      ")",
      "FROM memory_embeddings e",
      "JOIN memories m ON m.id = e.memory_id",
      `WHERE e.provider = ${sqlText(provider.name)} AND e.model = ${sqlText(provider.model)}`,
      "AND m.deleted_at IS NULL AND m.excluded_from_recall = 0",
      "ORDER BY e.updated_at DESC",
      `LIMIT ${Math.max(100, maxResults * 4)};`
    ].join("\n")
  );
  if (!raw.trim()) {
    return [];
  }
  const scored: VectorSearchResult[] = [];
  for (const line of raw.split("\n")) {
    try {
      const parsed = JSON.parse(line) as { id?: string; vector?: string };
      if (!parsed.id || typeof parsed.vector !== "string") {
        continue;
      }
      const vector = JSON.parse(parsed.vector) as number[];
      if (!Array.isArray(vector) || vector.length === 0) {
        continue;
      }
      const score = cosineSimilarity(queryVector, vector);
      scored.push({ id: parsed.id, score: Number.isFinite(score) ? score : 0 });
    } catch {
      continue;
    }
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, maxResults);
}

async function fetchEmbeddingRows(
  rootPath: string,
  maxRows: number
): Promise<Array<{ id: string; content: string }>> {
  const raw = await runMemoryStoreSql(
    rootPath,
    [
      "SELECT json_object(",
      "'id', id,",
      "'content', content",
      ")",
      "FROM memories",
      "WHERE deleted_at IS NULL AND excluded_from_recall = 0",
      "ORDER BY updated_at DESC",
      `LIMIT ${maxRows};`
    ].join("\n")
  );
  if (!raw.trim()) {
    return [];
  }
  const rows: Array<{ id: string; content: string }> = [];
  for (const line of raw.split("\n")) {
    try {
      const parsed = JSON.parse(line) as { id?: string; content?: string };
      const id = typeof parsed.id === "string" ? parsed.id : "";
      const content = typeof parsed.content === "string" ? parsed.content.trim() : "";
      if (!id || !content) {
        continue;
      }
      rows.push({ id, content: content.slice(0, 2000) });
    } catch {
      continue;
    }
  }
  return rows;
}

async function fetchExistingEmbeddingMeta(rootPath: string): Promise<Map<string, {
  provider: string;
  model: string;
  contentHash: string;
}>> {
  const raw = await runMemoryStoreSql(
    rootPath,
    "SELECT memory_id || '|' || provider || '|' || model || '|' || content_hash FROM memory_embeddings;"
  );
  const out = new Map<string, { provider: string; model: string; contentHash: string }>();
  if (!raw.trim()) {
    return out;
  }
  for (const line of raw.split("\n")) {
    const [memoryId, provider, model, contentHash] = line.split("|");
    if (!memoryId || !provider || !model || !contentHash) {
      continue;
    }
    out.set(memoryId, {
      provider,
      model,
      contentHash
    });
  }
  return out;
}

async function inferIndexedProvider(rootPath: string): Promise<"deepseek" | "local" | null> {
  const raw = await runMemoryStoreSql(
    rootPath,
    [
      "SELECT provider",
      "FROM memory_embeddings",
      "GROUP BY provider",
      "ORDER BY COUNT(*) DESC",
      "LIMIT 1;"
    ].join("\n")
  );
  const provider = raw.trim();
  if (provider === "deepseek" || provider === "local") {
    return provider;
  }
  return null;
}

function embedTextDeterministic(text: string, dim: number): number[] {
  const vec = new Array<number>(dim).fill(0);
  const tokens = text.toLowerCase().match(/[\p{L}\p{N}_]+/gu) ?? [];
  for (const token of tokens) {
    const digest = createHash("sha256").update(token, "utf8").digest();
    for (let i = 0; i < 8; i += 1) {
      const idx = digest[i] % dim;
      const sign = digest[i + 8] % 2 === 0 ? 1 : -1;
      vec[idx] += sign * (1 + digest[i + 16] / 255);
    }
  }
  const norm = Math.sqrt(vec.reduce((acc, v) => acc + v * v, 0));
  if (norm <= 1e-9) {
    return vec;
  }
  return vec.map((v) => v / norm);
}

function cosineSimilarity(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n === 0) {
    return 0;
  }
  let dot = 0;
  let an = 0;
  let bn = 0;
  for (let i = 0; i < n; i += 1) {
    const av = Number(a[i]) || 0;
    const bv = Number(b[i]) || 0;
    dot += av * bv;
    an += av * av;
    bn += bv * bv;
  }
  if (an <= 1e-9 || bn <= 1e-9) {
    return 0;
  }
  return dot / Math.sqrt(an * bn);
}

function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function sqlText(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}
