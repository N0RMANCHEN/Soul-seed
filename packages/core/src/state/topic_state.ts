import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { shouldUseStateDeltaPipelineFromRoot, writeStateDelta } from "./state_delta_writer.js";

export const TOPIC_STATE_FILENAME = "topic_state.json";
export const TOPIC_STATE_SCHEMA_VERSION = "1.0";

export interface TopicThread {
  threadId: string;
  topicId: string;
  status: "open" | "closed";
  lastTouchedAt?: string;
  summary?: string;
  evidence?: string[];
}

export interface TopicStateData {
  schemaVersion: "1.0";
  activeTopic: string;
  threads: TopicThread[];
  updatedAt?: string;
}

export function createInitialTopicState(nowIso?: string): TopicStateData {
  return {
    schemaVersion: TOPIC_STATE_SCHEMA_VERSION,
    activeTopic: "",
    threads: [],
    updatedAt: nowIso ?? new Date().toISOString()
  };
}

export function normalizeTopicState(raw: Record<string, unknown>): TopicStateData {
  const schemaVersion = raw.schemaVersion === TOPIC_STATE_SCHEMA_VERSION ? TOPIC_STATE_SCHEMA_VERSION : TOPIC_STATE_SCHEMA_VERSION;
  const activeTopic = typeof raw.activeTopic === "string" ? raw.activeTopic.slice(0, 64) : "";
  const threads = Array.isArray(raw.threads)
    ? raw.threads
        .filter((item): item is Record<string, unknown> => item !== null && typeof item === "object" && !Array.isArray(item))
        .map((item) => ({
          threadId: typeof item.threadId === "string" ? item.threadId.slice(0, 80) : "",
          topicId: typeof item.topicId === "string" ? item.topicId.slice(0, 64) : "",
          status: item.status === "closed" ? "closed" as const : "open" as const,
          ...(typeof item.lastTouchedAt === "string" ? { lastTouchedAt: item.lastTouchedAt } : {}),
          ...(typeof item.summary === "string" ? { summary: item.summary.slice(0, 160) } : {}),
          ...(Array.isArray(item.evidence)
            ? {
                evidence: item.evidence
                  .filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
                  .slice(0, 12)
              }
            : {})
        }))
        .filter((item) => item.threadId.length > 0 && item.topicId.length > 0)
        .slice(0, 20)
    : [];
  const updatedAt = typeof raw.updatedAt === "string" ? raw.updatedAt : undefined;
  return { schemaVersion, activeTopic, threads, ...(updatedAt ? { updatedAt } : {}) };
}

export async function loadTopicState(rootPath: string): Promise<TopicStateData | null> {
  const filePath = path.join(rootPath, TOPIC_STATE_FILENAME);
  if (!existsSync(filePath)) return null;
  try {
    const raw = JSON.parse(await readFile(filePath, "utf8")) as Record<string, unknown>;
    return normalizeTopicState(raw);
  } catch {
    return null;
  }
}

export async function writeTopicState(rootPath: string, data: TopicStateData): Promise<void> {
  if (await shouldUseStateDeltaPipelineFromRoot(rootPath)) {
    await writeStateDelta(
      rootPath,
      "topic_state",
      data as unknown as Record<string, unknown>,
      { confidence: 1.0, systemGenerated: true }
    );
    return;
  }
  await writeFile(path.join(rootPath, TOPIC_STATE_FILENAME), JSON.stringify(data, null, 2), "utf8");
}

export function evolveTopicStateFromTurn(
  current: TopicStateData,
  input: { nowIso?: string; topic?: string; summarySeed?: string; evidence?: string[] }
): TopicStateData {
  const nowIso = input.nowIso ?? new Date().toISOString();
  const topic = normalizeTopic(input.topic ?? current.activeTopic);
  const summary = typeof input.summarySeed === "string" ? input.summarySeed.trim().slice(0, 160) : "";
  const evidence = Array.isArray(input.evidence)
    ? input.evidence.filter((item): item is string => typeof item === "string" && item.trim().length > 0).slice(0, 12)
    : [];

  if (!topic) {
    return { ...current, updatedAt: nowIso };
  }

  const nextThreads = [...current.threads];
  const index = nextThreads.findIndex((thread) => thread.topicId === topic && thread.status === "open");
  if (index >= 0) {
    const existing = nextThreads[index];
    nextThreads[index] = {
      ...existing,
      lastTouchedAt: nowIso,
      ...(summary ? { summary } : {}),
      ...(evidence.length > 0 ? { evidence } : {})
    };
  } else {
    nextThreads.unshift({
      threadId: `th_${slug(topic)}`,
      topicId: topic,
      status: "open",
      lastTouchedAt: nowIso,
      ...(summary ? { summary } : {}),
      ...(evidence.length > 0 ? { evidence } : {})
    });
  }

  const threads = nextThreads
    .sort((a, b) => (b.lastTouchedAt ?? "").localeCompare(a.lastTouchedAt ?? ""))
    .slice(0, 20);

  return {
    schemaVersion: TOPIC_STATE_SCHEMA_VERSION,
    activeTopic: topic,
    threads,
    updatedAt: nowIso
  };
}

export async function updateTopicStateFromTurn(
  rootPath: string,
  input: {
    userInput: string;
    assistantOutput?: string;
    topTopic?: string;
    nowIso?: string;
    evidence?: string[];
  }
): Promise<TopicStateData> {
  const current = (await loadTopicState(rootPath)) ?? createInitialTopicState(input.nowIso);
  const next = evolveTopicStateFromTurn(current, {
    nowIso: input.nowIso,
    topic: input.topTopic,
    summarySeed: buildSummarySeed(input.userInput, input.assistantOutput),
    evidence: input.evidence
  });
  await writeTopicState(rootPath, next);
  return next;
}

function normalizeTopic(topic: string): string {
  return topic.trim().slice(0, 64);
}

function slug(input: string): string {
  const clean = input
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return clean.slice(0, 24) || "topic";
}

function buildSummarySeed(userInput: string, assistantOutput?: string): string {
  const user = userInput.trim();
  const assistant = (assistantOutput ?? "").trim();
  if (!user) return assistant.slice(0, 160);
  if (!assistant) return user.slice(0, 160);
  return `${user} | ${assistant}`.slice(0, 160);
}
