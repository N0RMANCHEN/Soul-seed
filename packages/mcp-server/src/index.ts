#!/usr/bin/env node
import process from "node:process";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadPersonaPackage } from "@soulseed/core";
import { ToolRegistry } from "./tool_registry.js";
import { createRpcServer } from "./server_factory.js";
import { startHttpServer } from "./http.js";

async function main(): Promise<void> {
  const personaPath = process.env["SOULSEED_PERSONA_PATH"];
  if (!personaPath) {
    process.stderr.write(
      "[soulseed-mcp] SOULSEED_PERSONA_PATH env var is required\n"
    );
    process.exit(1);
  }

  const personaPkg = await loadPersonaPackage(personaPath);
  const transportMode = (process.env["MCP_TRANSPORT"] ?? "stdio").trim().toLowerCase();
  if (transportMode === "http") {
    const host = process.env["MCP_HOST"]?.trim() || "127.0.0.1";
    const port = Number(process.env["MCP_PORT"] ?? 8787);
    const authToken = process.env["MCP_AUTH_TOKEN"]?.trim() || undefined;
    const rateLimitPerMinute = Number(process.env["MCP_RATE_LIMIT_PER_MINUTE"] ?? 120);
    await startHttpServer({
      personaPath,
      personaPkg,
      host,
      port: Number.isFinite(port) ? port : 8787,
      authToken,
      rateLimitPerMinute: Number.isFinite(rateLimitPerMinute) ? rateLimitPerMinute : 120
    });
    return;
  }

  const registry = new ToolRegistry({ personaPath, personaPkg });
  const server = createRpcServer(registry);
  await server.connect(new StdioServerTransport());
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  process.stderr.write(`[soulseed-mcp] Fatal error: ${msg}\n`);
  process.exit(1);
});
