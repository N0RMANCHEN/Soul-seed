/**
 * EA-1: 记忆提案协议（Agent Memory Proposal）
 * Agent 执行结果不能直接写入人格记忆；必须经过元认知裁决后才能 commit。
 * 三阶段：proposeMemory → arbitrateMemoryProposals → commitMemory
 */
import { randomUUID } from "node:crypto";
import { writeFile, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

export type MemoryProposalKind = "semantic" | "preference" | "relational" | "open_question";
export type MemoryProposalStatus = "pending" | "approved" | "rejected";

export interface AgentMemoryProposal {
  id: string;
  kind: MemoryProposalKind;
  content: string;
  evidenceRefs: string[];   // 来源：工具名 / goal step id / URL
  confidence: number;       // 0-1
  expiresAt?: string;       // 临时性记忆
  goalId: string;
  proposedAt: string;
  status: MemoryProposalStatus;
  rejectionReason?: string;
}

export interface MemoryArbitrationResult {
  accepted: AgentMemoryProposal[];
  rejected: Array<AgentMemoryProposal & { rejectionReason: string }>;
  rationale: string;
}

const PROPOSALS_FILENAME = "agent_memory_proposals.jsonl";

function getProposalsPath(rootPath: string): string {
  return path.join(rootPath, PROPOSALS_FILENAME);
}

/**
 * 提案 pending 记忆（写入候选池，未经批准不写入 persona 记忆）
 */
export async function proposeMemory(
  rootPath: string,
  proposal: Omit<AgentMemoryProposal, "id" | "proposedAt" | "status">
): Promise<AgentMemoryProposal> {
  const record: AgentMemoryProposal = {
    id: randomUUID(),
    proposedAt: new Date().toISOString(),
    status: "pending",
    ...proposal,
    confidence: Math.max(0, Math.min(1, proposal.confidence)),
    content: proposal.content.slice(0, 500),
    evidenceRefs: proposal.evidenceRefs.slice(0, 10)
  };
  const line = JSON.stringify(record) + "\n";
  await writeFile(getProposalsPath(rootPath), line, { flag: "a", encoding: "utf8" });
  return record;
}

/**
 * 加载所有 pending 提案
 */
export async function loadPendingProposals(rootPath: string): Promise<AgentMemoryProposal[]> {
  const p = getProposalsPath(rootPath);
  if (!existsSync(p)) return [];
  try {
    const text = await readFile(p, "utf8");
    const lines = text.split("\n").filter(l => l.trim().length > 0);
    const proposals: AgentMemoryProposal[] = [];
    for (const line of lines) {
      try {
        const obj = JSON.parse(line) as AgentMemoryProposal;
        if (obj.status === "pending") proposals.push(obj);
      } catch {
        // skip malformed lines
      }
    }
    return proposals;
  } catch {
    return [];
  }
}

/**
 * 加载所有提案（含已裁决的）
 */
export async function loadAllProposals(rootPath: string): Promise<AgentMemoryProposal[]> {
  const p = getProposalsPath(rootPath);
  if (!existsSync(p)) return [];
  try {
    const text = await readFile(p, "utf8");
    const lines = text.split("\n").filter(l => l.trim().length > 0);
    const proposals: AgentMemoryProposal[] = [];
    for (const line of lines) {
      try {
        proposals.push(JSON.parse(line) as AgentMemoryProposal);
      } catch {
        // skip malformed lines
      }
    }
    return proposals;
  } catch {
    return [];
  }
}

/**
 * EA-1: 裁决提案（规则层，不调用 LLM）
 * 规则：
 * - confidence < 0.5 → reject
 * - kind === "open_question" → reject（暂存，待用户确认）
 * - content 为空 → reject
 * - 已过期（expiresAt 早于现在）→ reject
 */
export function arbitrateMemoryProposals(
  proposals: AgentMemoryProposal[]
): MemoryArbitrationResult {
  const now = Date.now();
  const accepted: AgentMemoryProposal[] = [];
  const rejected: Array<AgentMemoryProposal & { rejectionReason: string }> = [];
  const rationales: string[] = [];

  for (const p of proposals) {
    let reason: string | null = null;
    if (!p.content || p.content.trim().length === 0) {
      reason = "empty content";
    } else if (p.confidence < 0.5) {
      reason = `confidence too low (${p.confidence.toFixed(2)} < 0.5)`;
    } else if (p.kind === "open_question") {
      reason = "open_question: requires user confirmation before committing";
    } else if (p.expiresAt && Date.parse(p.expiresAt) < now) {
      reason = `expired at ${p.expiresAt}`;
    }

    if (reason) {
      rejected.push({ ...p, status: "rejected", rejectionReason: reason });
      rationales.push(`rejected [${p.id.slice(0, 8)}]: ${reason}`);
    } else {
      accepted.push({ ...p, status: "approved" });
    }
  }

  const rationale = rationales.length > 0
    ? `Rejected ${rejected.length}/${proposals.length}: ${rationales.join("; ")}`
    : `All ${accepted.length} proposals accepted`;

  return { accepted, rejected, rationale };
}

/**
 * EA-1: 将裁决结果持久化（覆写 proposals 文件中的状态）
 */
export async function persistArbitrationResult(
  rootPath: string,
  result: MemoryArbitrationResult
): Promise<void> {
  const all = await loadAllProposals(rootPath);
  const byId = new Map<string, AgentMemoryProposal>();
  for (const p of all) byId.set(p.id, p);

  for (const a of result.accepted) byId.set(a.id, a);
  for (const r of result.rejected) byId.set(r.id, r);

  const p = getProposalsPath(rootPath);
  const lines = [...byId.values()].map(entry => JSON.stringify(entry)).join("\n") + "\n";
  await writeFile(p, lines, { encoding: "utf8" });
}

/**
 * EA-1: commit 已批准的提案到 persona 记忆（通过 memory_store writeMemory）
 * 返回已提交的 content 列表。
 * 注意：调用者负责传入 writeMemory 函数，以避免循环依赖。
 */
export async function commitApprovedProposals(
  rootPath: string,
  accepted: AgentMemoryProposal[],
  writeMemory: (rootPath: string, content: string, meta?: Record<string, unknown>) => Promise<void>
): Promise<string[]> {
  const committed: string[] = [];
  for (const proposal of accepted) {
    try {
      await writeMemory(rootPath, proposal.content, {
        source: "agent_proposal",
        goalId: proposal.goalId,
        proposalId: proposal.id,
        confidence: proposal.confidence,
        kind: proposal.kind
      });
      committed.push(proposal.content.slice(0, 80));
    } catch {
      // non-fatal: log but continue
    }
  }
  return committed;
}
