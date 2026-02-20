import path from "node:path";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";

// ── constants ──────────────────────────────────────────────────────────────────

export const GOLDEN_EXAMPLES_FILENAME = "golden_examples.jsonl";
export const MAX_GOLDEN_EXAMPLES = 50;
export const MAX_CHARS_PER_EXAMPLE = 300;
/** Default character budget for few-shot injection into prompts (≈10% of 30k context) */
export const DEFAULT_FEWSHOT_BUDGET_CHARS = 3000;

// ── types ─────────────────────────────────────────────────────────────────────

export type GoldenExampleSource = "user" | "meta_review";

export interface GoldenExample {
  id: string;
  version: number;
  addedAt: string;
  addedBy: GoldenExampleSource;
  label: string;
  userContent: string;
  assistantContent: string;
  /** ISO8601 or null — if set, example will not be injected after this date */
  expiresAt: string | null;
}

export interface GoldenExamplesAddOptions {
  label?: string;
  addedBy?: GoldenExampleSource;
  expiresAt?: string | null;
}

export interface GoldenExamplesStats {
  total: number;
  active: number;
  expired: number;
  bySource: Record<GoldenExampleSource, number>;
}

// ── I/O ───────────────────────────────────────────────────────────────────────

function examplesPath(rootPath: string): string {
  return path.join(rootPath, GOLDEN_EXAMPLES_FILENAME);
}

export async function listGoldenExamples(rootPath: string): Promise<GoldenExample[]> {
  const filePath = examplesPath(rootPath);
  if (!existsSync(filePath)) return [];
  const content = await readFile(filePath, "utf8");
  return content
    .split("\n")
    .filter(Boolean)
    .map(line => JSON.parse(line) as GoldenExample);
}

async function writeGoldenExamples(rootPath: string, examples: GoldenExample[]): Promise<void> {
  const filePath = examplesPath(rootPath);
  const content = examples.map(e => JSON.stringify(e)).join("\n") + (examples.length > 0 ? "\n" : "");
  await writeFile(filePath, content, "utf8");
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

export async function addGoldenExample(
  rootPath: string,
  userContent: string,
  assistantContent: string,
  options: GoldenExamplesAddOptions = {}
): Promise<{ ok: boolean; example?: GoldenExample; reason?: string }> {
  const userTrimmed = userContent.trim().slice(0, MAX_CHARS_PER_EXAMPLE);
  const assistantTrimmed = assistantContent.trim().slice(0, MAX_CHARS_PER_EXAMPLE);

  if (!userTrimmed || !assistantTrimmed) {
    return { ok: false, reason: "user and assistant content must be non-empty" };
  }

  const examples = await listGoldenExamples(rootPath);

  if (examples.length >= MAX_GOLDEN_EXAMPLES) {
    return {
      ok: false,
      reason: `example limit reached (${MAX_GOLDEN_EXAMPLES}). Remove old examples before adding new ones.`
    };
  }

  const example: GoldenExample = {
    id: randomUUID(),
    version: 1,
    addedAt: new Date().toISOString(),
    addedBy: options.addedBy ?? "user",
    label: (options.label ?? "").trim().slice(0, 80) || "unlabeled",
    userContent: userTrimmed,
    assistantContent: assistantTrimmed,
    expiresAt: options.expiresAt ?? null
  };

  await writeGoldenExamples(rootPath, [...examples, example]);
  return { ok: true, example };
}

export async function removeGoldenExample(
  rootPath: string,
  idOrPrefix: string
): Promise<{ ok: boolean; removed?: GoldenExample; reason?: string }> {
  const examples = await listGoldenExamples(rootPath);
  const prefix = idOrPrefix.trim().toLowerCase();
  const idx = examples.findIndex(e => e.id.toLowerCase().startsWith(prefix));
  if (idx === -1) {
    return { ok: false, reason: `no example found with id prefix "${idOrPrefix}"` };
  }
  const removed = examples[idx];
  const next = [...examples.slice(0, idx), ...examples.slice(idx + 1)];
  await writeGoldenExamples(rootPath, next);
  return { ok: true, removed };
}

export async function getGoldenExamplesStats(rootPath: string): Promise<GoldenExamplesStats> {
  const examples = await listGoldenExamples(rootPath);
  const now = new Date().toISOString();
  const active = examples.filter(e => !e.expiresAt || e.expiresAt > now);
  const expired = examples.filter(e => e.expiresAt && e.expiresAt <= now);
  const bySource: Record<GoldenExampleSource, number> = { user: 0, meta_review: 0 };
  for (const e of examples) {
    bySource[e.addedBy] = (bySource[e.addedBy] ?? 0) + 1;
  }
  return { total: examples.length, active: active.length, expired: expired.length, bySource };
}

// ── Few-shot compilation ───────────────────────────────────────────────────────

/**
 * Build a formatted few-shot examples block for injection into the system prompt.
 * Only includes non-expired examples, respects character budget.
 */
export function compileGoldenExamplesBlock(
  examples: GoldenExample[],
  budgetChars = DEFAULT_FEWSHOT_BUDGET_CHARS
): string {
  const now = new Date().toISOString();
  const active = examples.filter(e => !e.expiresAt || e.expiresAt > now);

  if (active.length === 0) return "";

  const header = "Few-shot reference examples (best-practice persona turns):";
  let used = header.length + 2; // +2 for newlines
  const lines: string[] = [header, ""];

  for (const ex of active) {
    const exBlock = [
      `[Example${ex.label !== "unlabeled" ? ` — ${ex.label}` : ""}]`,
      `User: ${ex.userContent}`,
      `Assistant: ${ex.assistantContent}`,
      ""
    ].join("\n");

    if (used + exBlock.length > budgetChars) break;
    lines.push(exBlock);
    used += exBlock.length;
  }

  // Return empty if only the header was added (no examples fit)
  if (lines.length <= 2) return "";
  return lines.join("\n");
}

/**
 * Load golden examples from persona and compile the few-shot block.
 * Returns empty string if no examples or all expired.
 */
export async function loadAndCompileGoldenExamples(
  rootPath: string,
  budgetChars = DEFAULT_FEWSHOT_BUDGET_CHARS
): Promise<string> {
  const examples = await listGoldenExamples(rootPath);
  return compileGoldenExamplesBlock(examples, budgetChars);
}
