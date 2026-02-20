import path from "node:path";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { searchMemoriesHybrid } from "./memory_recall.js";

export interface RecallRegressionCase {
  id?: string;
  query: string;
  expectedIds?: string[];
  expectedTerms?: string[];
  forbiddenTerms?: string[];
}

export interface RecallRegressionDataset {
  name?: string;
  k?: number;
  cases: RecallRegressionCase[];
}

export interface RecallRegressionOptions {
  k?: number;
  maxCases?: number;
  outPath?: string;
}

export interface RecallRegressionReport {
  dataset: string;
  generatedAt: string;
  k: number;
  totalCases: number;
  scoredCases: number;
  metrics: {
    recallAtK: number;
    mrr: number;
    wrongRecallRate: number;
    injectionHitRate: number;
    avgLatencyMs: number;
  };
  cases: Array<{
    id: string;
    query: string;
    hit: boolean;
    reciprocalRank: number;
    wrongRecall: boolean;
    latencyMs: number;
    selectedIds: string[];
  }>;
}

export async function runRecallRegression(
  rootPath: string,
  datasetPath: string,
  options?: RecallRegressionOptions
): Promise<RecallRegressionReport> {
  const fullDatasetPath = path.resolve(datasetPath);
  const raw = await readFile(fullDatasetPath, "utf8");
  const parsed = JSON.parse(raw) as RecallRegressionDataset;
  const cases = Array.isArray(parsed.cases) ? parsed.cases : [];
  const k = Math.max(1, Math.min(50, Math.floor(options?.k ?? parsed.k ?? 8)));
  const requestedMaxCases = options?.maxCases ?? cases.length ?? 1;
  const limit = Math.max(1, Math.min(500, Math.floor(requestedMaxCases)));
  const pickedCases = cases.slice(0, limit);

  let hitCount = 0;
  let mrrSum = 0;
  let wrongRecallCount = 0;
  let injectionHitCount = 0;
  let latencySum = 0;
  const detailed: RecallRegressionReport["cases"] = [];

  for (let i = 0; i < pickedCases.length; i += 1) {
    const testCase = pickedCases[i];
    const query = String(testCase.query ?? "").trim();
    if (!query) {
      continue;
    }
    const started = Date.now();
    const result = await searchMemoriesHybrid(rootPath, query, { maxResults: k });
    const latencyMs = Date.now() - started;
    latencySum += latencyMs;

    const selectedIds = result.items.map((item) => item.id);
    const rr = reciprocalRank(result.items, testCase);
    const hit = rr > 0;
    const injectionHit = result.selectedIds.some((id) => selectedIds.includes(id));
    const wrongRecall = isWrongRecall(result.items.map((item) => item.content), testCase, hit);

    if (hit) {
      hitCount += 1;
    }
    if (injectionHit) {
      injectionHitCount += 1;
    }
    if (wrongRecall) {
      wrongRecallCount += 1;
    }
    mrrSum += rr;

    detailed.push({
      id: testCase.id?.trim() || `case_${i + 1}`,
      query,
      hit,
      reciprocalRank: rr,
      wrongRecall,
      latencyMs,
      selectedIds
    });
  }

  const scoredCases = detailed.length;
  const safeDiv = (num: number, den: number): number => (den > 0 ? num / den : 0);

  const report: RecallRegressionReport = {
    dataset: parsed.name?.trim() || path.basename(fullDatasetPath),
    generatedAt: new Date().toISOString(),
    k,
    totalCases: pickedCases.length,
    scoredCases,
    metrics: {
      recallAtK: round4(safeDiv(hitCount, scoredCases)),
      mrr: round4(safeDiv(mrrSum, scoredCases)),
      wrongRecallRate: round4(safeDiv(wrongRecallCount, scoredCases)),
      injectionHitRate: round4(safeDiv(injectionHitCount, scoredCases)),
      avgLatencyMs: round4(safeDiv(latencySum, scoredCases))
    },
    cases: detailed
  };

  if (typeof options?.outPath === "string" && options.outPath.trim().length > 0) {
    const fullOutPath = path.resolve(options.outPath);
    await mkdir(path.dirname(fullOutPath), { recursive: true });
    await writeFile(fullOutPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  }

  return report;
}

function reciprocalRank(
  items: Array<{ id: string; content: string }>,
  testCase: RecallRegressionCase
): number {
  for (let i = 0; i < items.length; i += 1) {
    if (isExpected(items[i], testCase)) {
      return 1 / (i + 1);
    }
  }
  return 0;
}

function isExpected(item: { id: string; content: string }, testCase: RecallRegressionCase): boolean {
  const expectedIds = Array.isArray(testCase.expectedIds)
    ? testCase.expectedIds.map((id) => id.trim()).filter(Boolean)
    : [];
  if (expectedIds.includes(item.id)) {
    return true;
  }

  const expectedTerms = Array.isArray(testCase.expectedTerms)
    ? testCase.expectedTerms.map((term) => term.trim().toLowerCase()).filter(Boolean)
    : [];
  if (expectedTerms.length === 0) {
    return false;
  }
  const contentLower = item.content.toLowerCase();
  return expectedTerms.some((term) => contentLower.includes(term));
}

function isWrongRecall(contents: string[], testCase: RecallRegressionCase, hit: boolean): boolean {
  const forbiddenTerms = Array.isArray(testCase.forbiddenTerms)
    ? testCase.forbiddenTerms.map((term) => term.trim().toLowerCase()).filter(Boolean)
    : [];
  if (forbiddenTerms.length > 0) {
    const joined = contents.join("\n").toLowerCase();
    return forbiddenTerms.some((term) => joined.includes(term));
  }

  const hasExpectation =
    (Array.isArray(testCase.expectedIds) && testCase.expectedIds.length > 0) ||
    (Array.isArray(testCase.expectedTerms) && testCase.expectedTerms.length > 0);
  if (!hasExpectation) {
    return false;
  }

  return !hit && contents.length > 0;
}

function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}
