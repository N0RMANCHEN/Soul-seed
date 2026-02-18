import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type CallToolResult
} from "@modelcontextprotocol/sdk/types.js";
import { TOOL_DEFINITIONS } from "./tool_definitions.js";
import type { ToolRegistry } from "./tool_registry.js";

export function createRpcServer(registry: ToolRegistry): Server {
  const server = new Server(
    { name: "soulseed", version: "0.1.0" },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools: TOOL_DEFINITIONS };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request): Promise<CallToolResult> => {
    const toolName = request.params.name;
    const args = (request.params.arguments ?? {}) as Record<string, unknown>;
    return registry.dispatch(toolName, args);
  });

  return server;
}
