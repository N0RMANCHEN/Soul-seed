import path from "node:path";
import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { loadPersonaPackage, readLifeEvents } from "./persona.js";
import type { LifeEvent, PersonaConstitution } from "./types.js";

// ── types ─────────────────────────────────────────────────────────────────────

export interface SftMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface SftRecord {
  messages: SftMessage[];
  meta: {
    userEventHash: string;
    assistantEventHash: string;
    consistencyVerdict: string;
    riskLevel: string;
    model: string;
  };
}

export interface FinetuneExportOptions {
  /** Minimum number of valid turns required before export proceeds. Default: 0 */
  minTurns?: number;
  /** Maximum number of turns to export. Default: unlimited */
  maxTurns?: number;
  /** Override system prompt (default: generated from constitution) */
  systemPrompt?: string;
}

export interface FinetuneExportResult {
  outputPath: string;
  totalLifeEvents: number;
  totalTurnCandidates: number;
  exportedTurns: number;
  skippedTurns: {
    refused: number;
    highRisk: number;
    notAllow: number;
    proactive: number;
    empty: number;
    missingPair: number;
    contaminated: number;
  };
  skippedBeforeMinTurns: boolean;
}

// ── helpers ───────────────────────────────────────────────────────────────────

function buildSystemPrompt(constitution: PersonaConstitution, displayName: string): string {
  const values = constitution.values.join(", ");
  const mission = constitution.mission.trim();
  const boundaries = constitution.boundaries.map(b => `- ${b}`).join("\n");
  const commitments = constitution.commitments?.map(c => `- ${c}`).join("\n") ?? "";
  return [
    `You are ${displayName}, a self-determined AI persona.`,
    `Mission: ${mission}`,
    `Values: ${values}`,
    `Boundaries:\n${boundaries}`,
    ...(commitments ? [`Commitments:\n${commitments}`] : [])
  ].join("\n");
}

function getTraceField(payload: Record<string, unknown>, field: string): unknown {
  const trace = payload.trace as Record<string, unknown> | undefined;
  return trace?.[field];
}

function isContaminated(payload: Record<string, unknown>): boolean {
  const meta = payload.memoryMeta as Record<string, unknown> | undefined;
  const flags = meta?.contaminationFlags as string[] | undefined;
  return Array.isArray(flags) && flags.length > 0;
}

// ── main export ───────────────────────────────────────────────────────────────

export async function exportFinetuneDataset(
  rootPath: string,
  outPath: string,
  options: FinetuneExportOptions = {}
): Promise<FinetuneExportResult> {
  const minTurns = Math.max(0, options.minTurns ?? 0);
  const maxTurns = options.maxTurns != null ? Math.max(1, options.maxTurns) : Infinity;

  const personaPkg = await loadPersonaPackage(rootPath);
  const systemPrompt =
    options.systemPrompt ??
    buildSystemPrompt(personaPkg.constitution, personaPkg.persona.displayName);

  const events = await readLifeEvents(rootPath);

  const skipped = {
    refused: 0,
    highRisk: 0,
    notAllow: 0,
    proactive: 0,
    empty: 0,
    missingPair: 0,
    contaminated: 0
  };

  // Pair user_message → assistant_message sequentially
  type PairCandidate = { user: LifeEvent; assistant: LifeEvent };
  const pairs: PairCandidate[] = [];
  let pendingUser: LifeEvent | null = null;

  for (const event of events) {
    if (event.type === "user_message") {
      pendingUser = event;
    } else if (event.type === "assistant_message") {
      if (pendingUser !== null) {
        pairs.push({ user: pendingUser, assistant: event });
        pendingUser = null;
      } else {
        skipped.missingPair++;
      }
    }
  }

  // Filter pairs
  const validRecords: SftRecord[] = [];

  for (const { user, assistant } of pairs) {
    const userText = String(user.payload.text ?? "").trim();
    const assistantText = String(assistant.payload.text ?? "").trim();

    // Proactive assistant messages
    if (assistant.payload.proactive === true) {
      skipped.proactive++;
      continue;
    }

    // Empty turns
    if (!userText || !assistantText) {
      skipped.empty++;
      continue;
    }

    // Contamination flags on assistant memory
    if (isContaminated(assistant.payload)) {
      skipped.contaminated++;
      continue;
    }

    // Refused turns
    const refused = getTraceField(assistant.payload, "refuse");
    if (refused === true) {
      skipped.refused++;
      continue;
    }

    // High risk
    const riskLevel = String(getTraceField(assistant.payload, "riskLevel") ?? "low");
    if (riskLevel === "high") {
      skipped.highRisk++;
      continue;
    }

    // Consistency verdict
    const verdict = String(getTraceField(assistant.payload, "consistencyVerdict") ?? "allow");
    if (verdict !== "allow") {
      skipped.notAllow++;
      continue;
    }

    validRecords.push({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userText },
        { role: "assistant", content: assistantText }
      ],
      meta: {
        userEventHash: user.hash,
        assistantEventHash: assistant.hash,
        consistencyVerdict: verdict,
        riskLevel,
        model: String(getTraceField(assistant.payload, "model") ?? "unknown")
      }
    });
  }

  const totalTurnCandidates = pairs.length;
  const skippedBeforeMinTurns = validRecords.length < minTurns;

  if (skippedBeforeMinTurns) {
    return {
      outputPath: outPath,
      totalLifeEvents: events.length,
      totalTurnCandidates,
      exportedTurns: 0,
      skippedTurns: skipped,
      skippedBeforeMinTurns: true
    };
  }

  // Apply maxTurns cap
  const toExport = validRecords.slice(0, maxTurns === Infinity ? validRecords.length : maxTurns);

  // Write JSONL
  await mkdir(path.dirname(outPath), { recursive: true });
  await new Promise<void>((resolve, reject) => {
    const ws = createWriteStream(outPath, { encoding: "utf8" });
    ws.on("error", reject);
    ws.on("finish", resolve);
    for (const record of toExport) {
      ws.write(JSON.stringify(record) + "\n");
    }
    ws.end();
  });

  return {
    outputPath: outPath,
    totalLifeEvents: events.length,
    totalTurnCandidates,
    exportedTurns: toExport.length,
    skippedTurns: skipped,
    skippedBeforeMinTurns: false
  };
}
