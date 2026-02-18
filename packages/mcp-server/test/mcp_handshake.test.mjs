/**
 * mcp_handshake.test.mjs
 * Spawns the real MCP server and verifies JSON-RPC handshake via stdio.
 * The MCP SDK StdioServerTransport uses newline-delimited JSON.
 */
import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp } from "node:fs/promises";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline";

import { initPersonaPackage } from "@soulseed/core";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MCP_SERVER_PATH = path.resolve(__dirname, "../dist/index.js");

/**
 * Serialize a JSON-RPC message in newline-delimited format (used by MCP StdioServerTransport).
 */
function encodeLine(obj) {
  return JSON.stringify(obj) + "\n";
}

/**
 * Collect `count` newline-delimited JSON messages from a readable stream.
 * Resolves when `count` messages are collected or timeoutMs elapses.
 */
function collectMessages(readable, count, timeoutMs = 8000) {
  return new Promise((resolve) => {
    const messages = [];
    let done = false;

    const timer = setTimeout(() => {
      if (!done) { done = true; rl.close(); resolve(messages); }
    }, timeoutMs);

    const rl = createInterface({ input: readable, crlfDelay: Infinity });
    rl.on("line", (line) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      try {
        messages.push(JSON.parse(trimmed));
      } catch {
        return;
      }
      if (messages.length >= count && !done) {
        done = true;
        clearTimeout(timer);
        rl.close();
        resolve(messages);
      }
    });
    rl.once("close", () => {
      if (!done) { done = true; clearTimeout(timer); resolve(messages); }
    });
  });
}

test("MCP server responds to initialize + tools/list", { timeout: 20000 }, async (t) => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "ss-mcp-handshake-"));
  const personaPath = path.join(tmp, "HandshakePersona.soulseedpersona");
  await initPersonaPackage(personaPath, "HandshakePersona");

  const child = spawn(process.execPath, [MCP_SERVER_PATH], {
    stdio: ["pipe", "pipe", "pipe"],
    env: {
      ...process.env,
      SOULSEED_PERSONA_PATH: personaPath
    }
  });

  t.after(() => {
    try { child.kill("SIGTERM"); } catch {}
  });

  // Collect 2 responses: initialize + tools/list
  const messagesPromise = collectMessages(child.stdout, 2, 10000);

  // Send initialize request
  child.stdin.write(encodeLine({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2024-11-05",
      clientInfo: { name: "test-client", version: "0.0.1" },
      capabilities: {}
    }
  }));

  // Brief pause then send notification + list request
  await new Promise((r) => setTimeout(r, 300));
  child.stdin.write(encodeLine({ jsonrpc: "2.0", method: "notifications/initialized" }));
  child.stdin.write(encodeLine({
    jsonrpc: "2.0",
    id: 2,
    method: "tools/list",
    params: {}
  }));

  const messages = await messagesPromise;

  const initResponse = messages.find((m) => m.id === 1);
  const listResponse = messages.find((m) => m.id === 2);

  assert.ok(initResponse, `Must receive initialize response. Got ${messages.length} messages.`);
  assert.equal(initResponse.jsonrpc, "2.0");
  assert.ok(initResponse.result, "initialize must have result");
  assert.equal(initResponse.result.serverInfo.name, "soulseed");

  assert.ok(listResponse, `Must receive tools/list response. Got ${messages.length} messages: ${JSON.stringify(messages.map(m => m.id))}`);
  assert.ok(listResponse.result, "tools/list must have result");

  const tools = listResponse.result.tools;
  assert.ok(Array.isArray(tools), "tools must be an array");

  const toolNames = tools.map((t) => t.name);
  assert.ok(toolNames.includes("persona.get_context"), `persona.get_context missing. Got: ${toolNames.join(", ")}`);
  assert.ok(toolNames.includes("conversation.save_turn"), `conversation.save_turn missing. Got: ${toolNames.join(", ")}`);
  assert.ok(toolNames.includes("memory.search"), `memory.search missing. Got: ${toolNames.join(", ")}`);
  assert.ok(toolNames.includes("memory.inspect"), `memory.inspect missing. Got: ${toolNames.join(", ")}`);
});
