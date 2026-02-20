import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp } from "node:fs/promises";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";

import { initPersonaPackage } from "@soulseed/core";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MCP_SERVER_PATH = path.resolve(__dirname, "../dist/index.js");

async function getFreePort() {
  return await new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") {
        reject(new Error("failed to get free port"));
        return;
      }
      const port = addr.port;
      server.close((error) => {
        if (error) reject(error);
        else resolve(port);
      });
    });
    server.on("error", reject);
  });
}

function waitForOutput(child, pattern, timeoutMs = 10_000) {
  return new Promise((resolve, reject) => {
    let buffer = "";
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`timeout waiting for output: ${String(pattern)}`));
    }, timeoutMs);
    const onData = (chunk) => {
      buffer += String(chunk);
      if (pattern.test(buffer)) {
        cleanup();
        resolve(buffer);
      }
    };
    const onError = (err) => {
      cleanup();
      reject(err);
    };
    const cleanup = () => {
      clearTimeout(timer);
      child.stdout.off("data", onData);
      child.stderr.off("data", onData);
      child.off("error", onError);
    };
    child.stdout.on("data", onData);
    child.stderr.on("data", onData);
    child.on("error", onError);
  });
}

async function postJson(url, payload, headers = {}) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      ...headers
    },
    body: JSON.stringify(payload)
  });
  const bodyText = await response.text();
  const parsed = parseResponsePayload(bodyText);
  return { response, body: parsed };
}

function parseResponsePayload(bodyText) {
  const trimmed = String(bodyText ?? "").trim();
  if (!trimmed) {
    return null;
  }
  const sseDataLine = trimmed
    .split(/\r?\n/)
    .find((line) => line.startsWith("data: "));
  if (sseDataLine) {
    const dataText = sseDataLine.slice("data: ".length).trim();
    try {
      return JSON.parse(dataText);
    } catch {
      return { raw: trimmed };
    }
  }
  try {
    return JSON.parse(trimmed);
  } catch {
    return { raw: trimmed };
  }
}

test("HTTP transport supports initialize + tools/list + tools/call", { timeout: 30_000 }, async (t) => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "ss-mcp-http-"));
  const personaPath = path.join(tmp, "HttpPersona.soulseedpersona");
  await initPersonaPackage(personaPath, "HttpPersona");

  const port = await getFreePort();
  const child = spawn(process.execPath, [MCP_SERVER_PATH], {
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      SOULSEED_PERSONA_PATH: personaPath,
      MCP_TRANSPORT: "http",
      MCP_HOST: "127.0.0.1",
      MCP_PORT: String(port)
    }
  });

  t.after(() => {
    try { child.kill("SIGTERM"); } catch {}
  });

  await waitForOutput(child, /HTTP server listening/);
  const endpoint = `http://127.0.0.1:${port}/mcp`;

  const init = await postJson(endpoint, {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2024-11-05",
      clientInfo: { name: "test-http", version: "0.0.1" },
      capabilities: {}
    }
  });
  assert.equal(init.response.status, 200);
  assert.equal(init.body?.jsonrpc, "2.0");
  assert.equal(init.body?.id, 1);
  assert.equal(init.body?.result?.serverInfo?.name, "soulseed");
  const sessionId = init.response.headers.get("mcp-session-id");
  assert.ok(sessionId, "mcp-session-id header must exist");

  const toolsList = await postJson(
    endpoint,
    { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} },
    { "mcp-session-id": sessionId }
  );
  assert.equal(toolsList.response.status, 200);
  const tools = toolsList.body?.result?.tools ?? [];
  const toolNames = tools.map((item) => item.name);
  assert.equal(toolNames.includes("persona.get_context"), true);
  assert.equal(toolNames.includes("conversation.save_turn"), true);
  assert.equal(toolNames.includes("memory.search"), true);
  assert.equal(toolNames.includes("memory.search_hybrid"), true);
  assert.equal(toolNames.includes("memory.recall_trace_get"), true);
  assert.equal(toolNames.includes("memory.inspect"), true);

  const call = await postJson(
    endpoint,
    {
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: {
        name: "persona.get_context",
        arguments: { userInput: "你好" }
      }
    },
    { "mcp-session-id": sessionId }
  );
  assert.equal(call.response.status, 200);
  const toolPayload = JSON.parse(call.body?.result?.content?.[0]?.text ?? "{}");
  assert.equal(toolPayload.refuse === false || toolPayload.refuse === true, true);
});

test("HTTP transport returns 401 when MCP_AUTH_TOKEN is configured and missing", { timeout: 20_000 }, async (t) => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "ss-mcp-http-auth-"));
  const personaPath = path.join(tmp, "HttpAuthPersona.soulseedpersona");
  await initPersonaPackage(personaPath, "HttpAuthPersona");

  const port = await getFreePort();
  const child = spawn(process.execPath, [MCP_SERVER_PATH], {
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      SOULSEED_PERSONA_PATH: personaPath,
      MCP_TRANSPORT: "http",
      MCP_HOST: "127.0.0.1",
      MCP_PORT: String(port),
      MCP_AUTH_TOKEN: "secret-token"
    }
  });

  t.after(() => {
    try { child.kill("SIGTERM"); } catch {}
  });

  await waitForOutput(child, /HTTP server listening/);
  const endpoint = `http://127.0.0.1:${port}/mcp`;

  const noAuth = await postJson(endpoint, {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2024-11-05",
      clientInfo: { name: "test-http", version: "0.0.1" },
      capabilities: {}
    }
  });
  assert.equal(noAuth.response.status, 401);

  const withAuth = await postJson(
    endpoint,
    {
      jsonrpc: "2.0",
      id: 2,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        clientInfo: { name: "test-http", version: "0.0.1" },
        capabilities: {}
      }
    },
    { authorization: "Bearer secret-token" }
  );
  assert.equal(withAuth.response.status, 200);
});
