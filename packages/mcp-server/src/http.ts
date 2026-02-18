import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { URL } from "node:url";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import type { PersonaPackage } from "@soulseed/core";
import { ToolRegistry } from "./tool_registry.js";
import { createRpcServer } from "./server_factory.js";

interface HttpServerOptions {
  personaPath: string;
  personaPkg: PersonaPackage;
  host: string;
  port: number;
  authToken?: string;
  rateLimitPerMinute: number;
}

interface RateState {
  windowStartMs: number;
  count: number;
}

type SessionEntry =
  | {
      kind: "streamable";
      transport: StreamableHTTPServerTransport;
      registry: ToolRegistry;
    }
  | {
      kind: "sse";
      transport: SSEServerTransport;
      registry: ToolRegistry;
    };

export async function startHttpServer(options: HttpServerOptions): Promise<void> {
  const sessions = new Map<string, SessionEntry>();
  const rateByIp = new Map<string, RateState>();

  const server = createServer(async (req, res) => {
    const requestStartedAt = Date.now();
    try {
      if (req.url === "/health") {
        writeJson(res, 200, { ok: true });
        return;
      }

      if (!authorizeRequest(req, options.authToken)) {
        writeJson(res, 401, { error: "unauthorized" });
        return;
      }

      if (!rateLimitPass(req, rateByIp, options.rateLimitPerMinute)) {
        writeJson(res, 429, { error: "rate_limited" });
        return;
      }

      const url = new URL(req.url ?? "/", `http://${req.headers.host ?? `${options.host}:${options.port}`}`);
      const path = url.pathname;
      if (path === "/mcp") {
        await handleStreamableMcp(req, res, sessions, options);
      } else if (path === "/sse" && req.method === "GET") {
        await handleLegacySse(req, res, sessions, options);
      } else if (path === "/messages" && req.method === "POST") {
        await handleLegacyMessages(req, res, url, sessions);
      } else {
        writeJson(res, 404, { error: "not_found" });
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      writeJson(res, 500, { error: "internal_error", message: msg });
    } finally {
      const durationMs = Date.now() - requestStartedAt;
      logHttp({
        method: req.method ?? "UNKNOWN",
        url: req.url ?? "",
        durationMs
      });
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(options.port, options.host, () => resolve());
  });

  process.stdout.write(
    `[soulseed-mcp] HTTP server listening on http://${options.host}:${options.port}\n` +
    `[soulseed-mcp] Streamable endpoint: /mcp, legacy SSE endpoint: /sse\n`
  );
}

async function handleStreamableMcp(
  req: IncomingMessage,
  res: ServerResponse,
  sessions: Map<string, SessionEntry>,
  options: HttpServerOptions
): Promise<void> {
  const parsedBody = await readBodyJson(req);
  const sessionId = firstHeader(req, "mcp-session-id");
  let entry: SessionEntry | undefined = sessionId ? sessions.get(sessionId) : undefined;

  if (!entry) {
    const isInitialize = req.method === "POST" && isInitializeRequest(parsedBody);
    if (!isInitialize) {
      writeJson(res, 400, { error: "bad_request", reason: "missing_or_invalid_session" });
      return;
    }

    const registry = createRegistry(options.personaPath, options.personaPkg);
    let transportRef: StreamableHTTPServerTransport | null = null;
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (newSessionId) => {
        if (!transportRef) {
          return;
        }
        sessions.set(newSessionId, {
          kind: "streamable",
          transport: transportRef,
          registry
        });
      }
    });
    transportRef = transport;

    const rpcServer = createRpcServer(registry);
    await rpcServer.connect(transport);
    transport.onclose = () => {
      const sid = transport.sessionId;
      if (sid) {
        sessions.delete(sid);
      }
    };

    entry = {
      kind: "streamable",
      transport,
      registry
    };
  }

  if (entry.kind !== "streamable") {
    writeJson(res, 400, { error: "bad_request", reason: "session_transport_mismatch" });
    return;
  }

  await entry.transport.handleRequest(req, res, parsedBody);
}

async function handleLegacySse(
  _req: IncomingMessage,
  res: ServerResponse,
  sessions: Map<string, SessionEntry>,
  options: HttpServerOptions
): Promise<void> {
  const registry = createRegistry(options.personaPath, options.personaPkg);
  const transport = new SSEServerTransport("/messages", res);
  const rpcServer = createRpcServer(registry);
  await rpcServer.connect(transport);

  const sessionId = transport.sessionId;
  sessions.set(sessionId, { kind: "sse", transport, registry });
  transport.onclose = () => sessions.delete(sessionId);
}

async function handleLegacyMessages(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  sessions: Map<string, SessionEntry>
): Promise<void> {
  const sessionId = url.searchParams.get("sessionId");
  if (!sessionId) {
    writeJson(res, 400, { error: "bad_request", reason: "missing_sessionId" });
    return;
  }
  const entry = sessions.get(sessionId);
  if (!entry || entry.kind !== "sse") {
    writeJson(res, 404, { error: "session_not_found" });
    return;
  }
  const body = await readBodyJson(req);
  await entry.transport.handlePostMessage(req, res, body);
}

function createRegistry(personaPath: string, personaPkg: PersonaPackage): ToolRegistry {
  return new ToolRegistry({
    personaPath,
    personaPkg,
    auditLogger: (event) => {
      logTool(event);
    }
  });
}

function isInitializeRequest(body: unknown): boolean {
  if (!isRecord(body)) {
    return false;
  }
  return body.method === "initialize";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function firstHeader(req: IncomingMessage, name: string): string | undefined {
  const raw = req.headers[name];
  if (!raw) {
    return undefined;
  }
  return Array.isArray(raw) ? raw[0] : raw;
}

async function readBodyJson(req: IncomingMessage): Promise<unknown> {
  if (req.method === "GET" || req.method === "HEAD") {
    return undefined;
  }
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
    const total = chunks.reduce((sum, item) => sum + item.length, 0);
    if (total > 1_000_000) {
      throw new Error("request body too large");
    }
  }
  if (chunks.length === 0) {
    return undefined;
  }
  const text = Buffer.concat(chunks).toString("utf8").trim();
  if (!text) {
    return undefined;
  }
  return JSON.parse(text);
}

function authorizeRequest(req: IncomingMessage, authToken?: string): boolean {
  if (!authToken) {
    return true;
  }
  const auth = firstHeader(req, "authorization");
  if (!auth) {
    return false;
  }
  const expected = `Bearer ${authToken}`;
  return auth === expected;
}

function rateLimitPass(
  req: IncomingMessage,
  rateByIp: Map<string, RateState>,
  limitPerMinute: number
): boolean {
  if (limitPerMinute <= 0) {
    return true;
  }
  const ip = (req.socket.remoteAddress ?? "unknown").trim();
  const now = Date.now();
  const prev = rateByIp.get(ip);
  if (!prev || now - prev.windowStartMs >= 60_000) {
    rateByIp.set(ip, {
      windowStartMs: now,
      count: 1
    });
    return true;
  }
  if (prev.count >= limitPerMinute) {
    return false;
  }
  prev.count += 1;
  return true;
}

function writeJson(res: ServerResponse, status: number, payload: Record<string, unknown>): void {
  if (res.headersSent) {
    return;
  }
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

function logHttp(event: {
  method: string;
  url: string;
  durationMs: number;
}): void {
  process.stdout.write(
    `[soulseed-mcp][http] method=${event.method} url=${event.url} durationMs=${event.durationMs}\n`
  );
}

function logTool(event: {
  toolName: string;
  status: "ok" | "rejected";
  reason: string;
  durationMs: number;
}): void {
  process.stdout.write(
    `[soulseed-mcp][tool] name=${event.toolName} status=${event.status} durationMs=${event.durationMs} reason=${event.reason}\n`
  );
}
