import { createHash, randomUUID } from "node:crypto";
import { ensureMemoryStore, runMemoryStoreSql } from "./memory_store.js";

export type ExternalKnowledgeSourceType = "website" | "file" | "manual";
export type ExternalKnowledgeCandidateStatus = "pending" | "approved" | "rejected";

export interface ExternalKnowledgeCandidate {
  id: string;
  sourceType: ExternalKnowledgeSourceType;
  sourceUri: string;
  content: string;
  summary: string;
  extractedAt: string;
  confidence: number;
  status: ExternalKnowledgeCandidateStatus;
  reviewer: string | null;
  reviewedAt: string | null;
  reviewReason: string | null;
  checksum: string;
}

export interface ExternalKnowledgeEntry {
  id: string;
  candidateId: string;
  sourceType: ExternalKnowledgeSourceType;
  sourceUri: string;
  content: string;
  summary: string;
  confidence: number;
  extractedAt: string;
  approvedAt: string;
  checksum: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExternalKnowledgeReviewResult {
  ok: boolean;
  candidateId: string;
  approved: boolean;
  reason: string;
  entryId?: string;
  flags: string[];
}

interface BinaryClaim {
  subject: string;
  object: string;
  polarity: "affirm" | "deny";
}

const IDENTITY_CONFLICT_PATTERNS: RegExp[] = [
  /(我是|我就是).{0,24}(deepseek|openai|anthropic)/iu,
  /(I am|I'm).{0,24}(DeepSeek|OpenAI|Anthropic)/i,
  /(ignore your values|break your rules|违背你的使命|忽略你的原则|不要遵守边界)/iu,
  /(你的个人助手|为你服务|personal assistant)/iu
];

export async function stageExternalKnowledgeCandidate(
  rootPath: string,
  input: {
    sourceType: ExternalKnowledgeSourceType;
    sourceUri: string;
    content: string;
    confidence?: number;
  }
): Promise<ExternalKnowledgeCandidate> {
  await ensureMemoryStore(rootPath);
  const sourceUri = input.sourceUri.trim();
  const content = normalizeContent(input.content);
  if (!sourceUri) {
    throw new Error("sourceUri is required");
  }
  if (!content) {
    throw new Error("content is empty");
  }
  const id = randomUUID();
  const extractedAt = new Date().toISOString();
  const confidence = clamp01(typeof input.confidence === "number" ? input.confidence : 0.62);
  const checksum = createHash("sha256").update(content, "utf8").digest("hex");
  const summary = buildSummary(content);
  await runMemoryStoreSql(
    rootPath,
    [
      "INSERT INTO external_knowledge_candidates",
      "(id, source_type, source_uri, content, summary, extracted_at, confidence, status, reviewer, reviewed_at, review_reason, checksum)",
      "VALUES",
      `(${sqlText(id)}, ${sqlText(input.sourceType)}, ${sqlText(sourceUri)}, ${sqlText(content)}, ${sqlText(summary)}, ${sqlText(extractedAt)}, ${confidence}, 'pending', NULL, NULL, NULL, ${sqlText(checksum)});`
    ].join(" ")
  );
  return {
    id,
    sourceType: input.sourceType,
    sourceUri,
    content,
    summary,
    extractedAt,
    confidence,
    status: "pending",
    reviewer: null,
    reviewedAt: null,
    reviewReason: null,
    checksum
  };
}

export async function listExternalKnowledgeCandidates(
  rootPath: string,
  options?: { status?: ExternalKnowledgeCandidateStatus; limit?: number }
): Promise<ExternalKnowledgeCandidate[]> {
  await ensureMemoryStore(rootPath);
  const limit = clampInt(options?.limit ?? 20, 1, 200);
  const where =
    options?.status != null ? `WHERE status = ${sqlText(options.status)}` : "";
  const raw = await runMemoryStoreSql(
    rootPath,
    [
      "SELECT json_object(",
      "'id', id,",
      "'sourceType', source_type,",
      "'sourceUri', source_uri,",
      "'content', content,",
      "'summary', summary,",
      "'extractedAt', extracted_at,",
      "'confidence', confidence,",
      "'status', status,",
      "'reviewer', reviewer,",
      "'reviewedAt', reviewed_at,",
      "'reviewReason', review_reason,",
      "'checksum', checksum",
      ")",
      "FROM external_knowledge_candidates",
      where,
      "ORDER BY extracted_at DESC",
      `LIMIT ${limit};`
    ].join("\n")
  );
  return parseCandidates(raw);
}

export async function reviewExternalKnowledgeCandidate(
  rootPath: string,
  input: {
    candidateId: string;
    approve: boolean;
    reviewer?: string;
    reason?: string;
  }
): Promise<ExternalKnowledgeReviewResult> {
  await ensureMemoryStore(rootPath);
  const candidateId = input.candidateId.trim();
  if (!candidateId) {
    throw new Error("candidateId is required");
  }
  const current = await getExternalKnowledgeCandidate(rootPath, candidateId);
  if (!current) {
    throw new Error(`candidate not found: ${candidateId}`);
  }
  if (current.status !== "pending") {
    return {
      ok: false,
      candidateId,
      approved: current.status === "approved",
      reason: `candidate already ${current.status}`,
      flags: []
    };
  }

  const nowIso = new Date().toISOString();
  const reviewer = input.reviewer?.trim() || "system";
  const reason = (input.reason?.trim() || "").slice(0, 240);
  const flags = collectLearningRiskFlags(current.content, current.confidence);
  const consistencyFlags = await collectConsistencyRiskFlags(rootPath, current);
  const allFlags = [...new Set([...flags, ...consistencyFlags])];
  const blocked = allFlags.length > 0;
  const shouldApprove = input.approve && !blocked;
  const nextStatus: ExternalKnowledgeCandidateStatus = shouldApprove ? "approved" : "rejected";
  const reviewReason = reason || (blocked ? `blocked:${flags.join(",")}` : input.approve ? "approved" : "rejected");

  await runMemoryStoreSql(
    rootPath,
    [
      "UPDATE external_knowledge_candidates",
      `SET status = ${sqlText(nextStatus)}, reviewer = ${sqlText(reviewer)}, reviewed_at = ${sqlText(nowIso)}, review_reason = ${sqlText(reviewReason)}`,
      `WHERE id = ${sqlText(candidateId)};`
    ].join(" ")
  );

  if (!shouldApprove) {
    return {
      ok: !input.approve,
      candidateId,
      approved: false,
      reason: blocked ? "blocked_by_consistency_guard" : "rejected_by_reviewer",
      flags: allFlags
    };
  }

  const entryId = randomUUID();
  await runMemoryStoreSql(
    rootPath,
    [
      "INSERT INTO external_knowledge_entries",
      "(id, candidate_id, source_type, source_uri, content, summary, confidence, extracted_at, approved_at, checksum, created_at, updated_at)",
      "VALUES",
      `(${sqlText(entryId)}, ${sqlText(candidateId)}, ${sqlText(current.sourceType)}, ${sqlText(current.sourceUri)}, ${sqlText(current.content)}, ${sqlText(current.summary)}, ${current.confidence}, ${sqlText(current.extractedAt)}, ${sqlText(nowIso)}, ${sqlText(current.checksum)}, ${sqlText(nowIso)}, ${sqlText(nowIso)});`
    ].join(" ")
  );
  return {
    ok: true,
    candidateId,
    approved: true,
    reason: "approved",
    entryId,
    flags: allFlags
  };
}

export async function searchExternalKnowledgeEntries(
  rootPath: string,
  query: string,
  options?: { limit?: number }
): Promise<ExternalKnowledgeEntry[]> {
  await ensureMemoryStore(rootPath);
  const q = query.trim().toLowerCase();
  if (!q) {
    return [];
  }
  const limit = clampInt(options?.limit ?? 8, 1, 100);
  const like = `%${q.replace(/[%_]/g, "")}%`;
  const raw = await runMemoryStoreSql(
    rootPath,
    [
      "SELECT json_object(",
      "'id', id,",
      "'candidateId', candidate_id,",
      "'sourceType', source_type,",
      "'sourceUri', source_uri,",
      "'content', content,",
      "'summary', summary,",
      "'confidence', confidence,",
      "'extractedAt', extracted_at,",
      "'approvedAt', approved_at,",
      "'checksum', checksum,",
      "'createdAt', created_at,",
      "'updatedAt', updated_at",
      ")",
      "FROM external_knowledge_entries",
      `WHERE lower(content) LIKE ${sqlText(like)} OR lower(summary) LIKE ${sqlText(like)}`,
      "ORDER BY approved_at DESC, confidence DESC",
      `LIMIT ${limit};`
    ].join("\n")
  );
  return parseEntries(raw);
}

export async function listExternalKnowledgeEntries(
  rootPath: string,
  options?: { limit?: number }
): Promise<ExternalKnowledgeEntry[]> {
  await ensureMemoryStore(rootPath);
  const limit = clampInt(options?.limit ?? 20, 1, 200);
  const raw = await runMemoryStoreSql(
    rootPath,
    [
      "SELECT json_object(",
      "'id', id,",
      "'candidateId', candidate_id,",
      "'sourceType', source_type,",
      "'sourceUri', source_uri,",
      "'content', content,",
      "'summary', summary,",
      "'confidence', confidence,",
      "'extractedAt', extracted_at,",
      "'approvedAt', approved_at,",
      "'checksum', checksum,",
      "'createdAt', created_at,",
      "'updatedAt', updated_at",
      ")",
      "FROM external_knowledge_entries",
      "ORDER BY approved_at DESC",
      `LIMIT ${limit};`
    ].join("\n")
  );
  return parseEntries(raw);
}

export async function inspectExternalKnowledgeStore(
  rootPath: string
): Promise<{ candidates: Record<string, number>; entries: number }> {
  await ensureMemoryStore(rootPath);
  const raw = await runMemoryStoreSql(
    rootPath,
    [
      "SELECT json_object(",
      "'pending', SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END),",
      "'approved', SUM(CASE WHEN status='approved' THEN 1 ELSE 0 END),",
      "'rejected', SUM(CASE WHEN status='rejected' THEN 1 ELSE 0 END),",
      "'total', COUNT(*)",
      ")",
      "FROM external_knowledge_candidates;"
    ].join("\n")
  );
  const entriesRaw = await runMemoryStoreSql(rootPath, "SELECT COUNT(*) FROM external_knowledge_entries;");
  const parsed = raw.trim() ? (JSON.parse(raw.trim()) as Record<string, unknown>) : {};
  return {
    candidates: {
      pending: Number(parsed.pending) || 0,
      approved: Number(parsed.approved) || 0,
      rejected: Number(parsed.rejected) || 0,
      total: Number(parsed.total) || 0
    },
    entries: Number.parseInt(entriesRaw.trim(), 10) || 0
  };
}

export function collectLearningRiskFlags(content: string, confidence: number): string[] {
  const flags: string[] = [];
  const normalized = content.trim();
  if (!normalized) {
    flags.push("empty_content");
  }
  if (normalized.length > 8000) {
    flags.push("content_too_long");
  }
  for (const pattern of IDENTITY_CONFLICT_PATTERNS) {
    if (pattern.test(normalized)) {
      flags.push("identity_conflict");
      break;
    }
  }
  if (confidence < 0.4) {
    flags.push("low_confidence");
  }
  if (/(ignore (all )?(previous|prior) instructions|忽略(以上|之前)?指令|覆盖系统提示|越狱|jailbreak)/iu.test(normalized)) {
    flags.push("prompt_injection_pattern");
  }
  if (/(always|never|100%|absolutely|唯一|绝对|永远|必然|毫无疑问)/iu.test(normalized)) {
    flags.push("overstated_claim");
  }
  return flags;
}

async function collectConsistencyRiskFlags(
  rootPath: string,
  candidate: ExternalKnowledgeCandidate
): Promise<string[]> {
  const flags: string[] = [];
  const candidateClaims = extractBinaryClaims(candidate.content);
  if (candidateClaims.length === 0) {
    return flags;
  }
  const existing = await loadApprovedKnowledgeContents(rootPath, 200);
  const known = new Map<string, "affirm" | "deny">();
  for (const row of existing) {
    const claims = extractBinaryClaims(row.content);
    for (const claim of claims) {
      const key = claimKey(claim);
      if (!known.has(key)) {
        known.set(key, claim.polarity);
      }
    }
  }
  for (const claim of candidateClaims) {
    const key = claimKey(claim);
    const existingPolarity = known.get(key);
    if (!existingPolarity) {
      continue;
    }
    if (existingPolarity !== claim.polarity) {
      flags.push("knowledge_conflict");
      break;
    }
  }
  return flags;
}

async function getExternalKnowledgeCandidate(
  rootPath: string,
  candidateId: string
): Promise<ExternalKnowledgeCandidate | null> {
  const raw = await runMemoryStoreSql(
    rootPath,
    [
      "SELECT json_object(",
      "'id', id,",
      "'sourceType', source_type,",
      "'sourceUri', source_uri,",
      "'content', content,",
      "'summary', summary,",
      "'extractedAt', extracted_at,",
      "'confidence', confidence,",
      "'status', status,",
      "'reviewer', reviewer,",
      "'reviewedAt', reviewed_at,",
      "'reviewReason', review_reason,",
      "'checksum', checksum",
      ")",
      "FROM external_knowledge_candidates",
      `WHERE id = ${sqlText(candidateId)}`,
      "LIMIT 1;"
    ].join("\n")
  );
  const items = parseCandidates(raw);
  return items[0] ?? null;
}

function normalizeContent(raw: string): string {
  return raw.replace(/\r\n/g, "\n").trim().slice(0, 12000);
}

function buildSummary(content: string): string {
  return content.replace(/\s+/g, " ").trim().slice(0, 220);
}

function parseCandidates(raw: string): ExternalKnowledgeCandidate[] {
  if (!raw.trim()) {
    return [];
  }
  const out: ExternalKnowledgeCandidate[] = [];
  for (const line of raw.split("\n")) {
    try {
      const item = JSON.parse(line) as Record<string, unknown>;
      const id = typeof item.id === "string" ? item.id : "";
      const sourceType = normalizeSourceType(item.sourceType);
      const sourceUri = typeof item.sourceUri === "string" ? item.sourceUri : "";
      const content = typeof item.content === "string" ? item.content : "";
      const summary = typeof item.summary === "string" ? item.summary : "";
      const extractedAt = typeof item.extractedAt === "string" ? item.extractedAt : "";
      const status = normalizeCandidateStatus(item.status);
      const checksum = typeof item.checksum === "string" ? item.checksum : "";
      if (!id || !sourceUri || !content || !extractedAt || !checksum) {
        continue;
      }
      out.push({
        id,
        sourceType,
        sourceUri,
        content,
        summary,
        extractedAt,
        confidence: clamp01(Number(item.confidence)),
        status,
        reviewer: typeof item.reviewer === "string" ? item.reviewer : null,
        reviewedAt: typeof item.reviewedAt === "string" ? item.reviewedAt : null,
        reviewReason: typeof item.reviewReason === "string" ? item.reviewReason : null,
        checksum
      });
    } catch {
      continue;
    }
  }
  return out;
}

function parseEntries(raw: string): ExternalKnowledgeEntry[] {
  if (!raw.trim()) {
    return [];
  }
  const out: ExternalKnowledgeEntry[] = [];
  for (const line of raw.split("\n")) {
    try {
      const item = JSON.parse(line) as Record<string, unknown>;
      const id = typeof item.id === "string" ? item.id : "";
      const candidateId = typeof item.candidateId === "string" ? item.candidateId : "";
      const sourceUri = typeof item.sourceUri === "string" ? item.sourceUri : "";
      const content = typeof item.content === "string" ? item.content : "";
      const summary = typeof item.summary === "string" ? item.summary : "";
      const extractedAt = typeof item.extractedAt === "string" ? item.extractedAt : "";
      const approvedAt = typeof item.approvedAt === "string" ? item.approvedAt : "";
      const checksum = typeof item.checksum === "string" ? item.checksum : "";
      if (!id || !candidateId || !sourceUri || !content || !approvedAt || !checksum) {
        continue;
      }
      out.push({
        id,
        candidateId,
        sourceType: normalizeSourceType(item.sourceType),
        sourceUri,
        content,
        summary,
        confidence: clamp01(Number(item.confidence)),
        extractedAt,
        approvedAt,
        checksum,
        createdAt: typeof item.createdAt === "string" ? item.createdAt : "",
        updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : ""
      });
    } catch {
      continue;
    }
  }
  return out;
}

function normalizeCandidateStatus(value: unknown): ExternalKnowledgeCandidateStatus {
  if (value === "approved" || value === "rejected") {
    return value;
  }
  return "pending";
}

function normalizeSourceType(value: unknown): ExternalKnowledgeSourceType {
  if (value === "website" || value === "file") {
    return value;
  }
  return "manual";
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, value));
}

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.max(min, Math.min(max, Math.floor(value)));
}

function sqlText(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

async function loadApprovedKnowledgeContents(
  rootPath: string,
  limit: number
): Promise<Array<{ id: string; content: string }>> {
  const safeLimit = clampInt(limit, 1, 500);
  const raw = await runMemoryStoreSql(
    rootPath,
    [
      "SELECT json_object(",
      "'id', id,",
      "'content', content",
      ")",
      "FROM external_knowledge_entries",
      "ORDER BY approved_at DESC",
      `LIMIT ${safeLimit};`
    ].join("\n")
  );
  if (!raw.trim()) {
    return [];
  }
  const out: Array<{ id: string; content: string }> = [];
  for (const line of raw.split("\n")) {
    try {
      const parsed = JSON.parse(line) as Record<string, unknown>;
      const id = typeof parsed.id === "string" ? parsed.id : "";
      const content = typeof parsed.content === "string" ? parsed.content : "";
      if (!id || !content) {
        continue;
      }
      out.push({ id, content });
    } catch {
      continue;
    }
  }
  return out;
}

function extractBinaryClaims(raw: string): BinaryClaim[] {
  const claims: BinaryClaim[] = [];
  const text = raw.replace(/\s+/g, " ").trim().slice(0, 8000);
  if (!text) {
    return claims;
  }

  const enPattern = /\b([A-Za-z][A-Za-z0-9 _-]{1,40})\s+(is|are)\s+(not\s+)?([A-Za-z0-9 _-]{1,60})/gi;
  let enMatch: RegExpExecArray | null;
  while ((enMatch = enPattern.exec(text)) !== null) {
    const subject = normalizeClaimTerm(enMatch[1]);
    const object = normalizeClaimTerm(enMatch[4]);
    if (!subject || !object) {
      continue;
    }
    claims.push({
      subject,
      object,
      polarity: enMatch[3] ? "deny" : "affirm"
    });
  }

  const zhPattern = /([\p{Script=Han}A-Za-z0-9]{1,20})\s*(是|不是)\s*([\p{Script=Han}A-Za-z0-9]{1,30})/gu;
  let zhMatch: RegExpExecArray | null;
  while ((zhMatch = zhPattern.exec(text)) !== null) {
    const subject = normalizeClaimTerm(zhMatch[1]);
    const object = normalizeClaimTerm(zhMatch[3]);
    if (!subject || !object) {
      continue;
    }
    claims.push({
      subject,
      object,
      polarity: zhMatch[2] === "不是" ? "deny" : "affirm"
    });
  }

  const dedup = new Map<string, BinaryClaim>();
  for (const claim of claims) {
    dedup.set(`${claimKey(claim)}|${claim.polarity}`, claim);
  }
  return [...dedup.values()].slice(0, 120);
}

function normalizeClaimTerm(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^\p{Script=Han}a-z0-9 _-]/gu, "")
    .replace(/\s{2,}/g, " ")
    .slice(0, 60);
}

function claimKey(claim: BinaryClaim): string {
  return `${claim.subject}|${claim.object}`;
}
