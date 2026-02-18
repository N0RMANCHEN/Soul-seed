import { randomUUID } from "node:crypto";
import { appendLifeEvent } from "@soulseed/core";
import type { PersonaPackage } from "@soulseed/core";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { runPersonaContextTool } from "./tools/persona_context.js";
import { runConversationSaveTool } from "./tools/conversation_save.js";
import { runMemorySearchTool } from "./tools/memory_search.js";
import { runMemoryInspectTool } from "./tools/memory_inspect.js";

interface ToolBudget {
  cost: number;
  sessionMax: number;
}

const TOOL_BUDGET: Record<string, ToolBudget> = {
  "persona.get_context":    { cost: 2, sessionMax: 50 },
  "conversation.save_turn": { cost: 2, sessionMax: 50 },
  "memory.search":          { cost: 1, sessionMax: 50 },
  "memory.inspect":         { cost: 1, sessionMax: 100 }
};

const ALLOWED_TOOLS = new Set(Object.keys(TOOL_BUDGET));

function errorResult(message: string): CallToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify({ error: message }) }],
    isError: true
  };
}

export interface ToolRegistryOptions {
  personaPath: string;
  personaPkg: PersonaPackage;
  budgetOverrides?: Partial<Record<string, Partial<ToolBudget>>>;
  auditLogger?: (event: {
    toolName: string;
    status: "ok" | "rejected";
    reason: string;
    durationMs: number;
  }) => void;
}

export class ToolRegistry {
  private readonly personaPath: string;
  private readonly personaPkg: PersonaPackage;
  private readonly callCounts = new Map<string, number>();
  private readonly effectiveBudget: Record<string, ToolBudget>;
  private readonly auditLogger?: ToolRegistryOptions["auditLogger"];

  constructor(opts: ToolRegistryOptions) {
    this.personaPath = opts.personaPath;
    this.personaPkg = opts.personaPkg;

    // Build effective budget, merging overrides
    this.effectiveBudget = { ...TOOL_BUDGET };
    if (opts.budgetOverrides) {
      for (const [tool, override] of Object.entries(opts.budgetOverrides)) {
        if (this.effectiveBudget[tool]) {
          this.effectiveBudget[tool] = {
            ...this.effectiveBudget[tool],
            ...override
          };
        }
      }
    }
    this.auditLogger = opts.auditLogger;
  }

  async dispatch(toolName: string, args: Record<string, unknown>): Promise<CallToolResult> {
    const startedAt = Date.now();
    if (!ALLOWED_TOOLS.has(toolName)) {
      await appendLifeEvent(this.personaPath, {
        type: "mcp_tool_rejected",
        payload: {
          toolName,
          reason: "tool_not_in_allow_list"
        }
      }).catch(() => undefined);
      this.auditLogger?.({
        toolName,
        status: "rejected",
        reason: "tool_not_in_allow_list",
        durationMs: Date.now() - startedAt
      });
      return errorResult("tool_not_allowed");
    }

    const budget = this.effectiveBudget[toolName];
    const callCount = this.callCounts.get(toolName) ?? 0;

    if (callCount >= budget.sessionMax) {
      await appendLifeEvent(this.personaPath, {
        type: "mcp_tool_rejected",
        payload: {
          toolName,
          reason: "session_budget_exceeded",
          callCount,
          sessionMax: budget.sessionMax
        }
      }).catch(() => undefined);
      this.auditLogger?.({
        toolName,
        status: "rejected",
        reason: "session_budget_exceeded",
        durationMs: Date.now() - startedAt
      });
      return errorResult("session_budget_exceeded");
    }

    this.callCounts.set(toolName, callCount + 1);
    const callId = randomUUID();

    try {
      let result: unknown;

      if (toolName === "persona.get_context") {
        result = await runPersonaContextTool(
          {
            userInput: String(args.userInput ?? ""),
            maxMemories: typeof args.maxMemories === "number" ? args.maxMemories : undefined
          },
          {
            personaPath: this.personaPath,
            personaPkg: this.personaPkg
          }
        );
      } else if (toolName === "conversation.save_turn") {
        result = await runConversationSaveTool(
          {
            userMessage: String(args.userMessage ?? ""),
            assistantMessage: String(args.assistantMessage ?? ""),
            selectedMemories: Array.isArray(args.selectedMemories)
              ? (args.selectedMemories as string[])
              : undefined
          },
          {
            personaPath: this.personaPath,
            personaPkg: this.personaPkg
          }
        );
      } else if (toolName === "memory.search") {
        const maxResults = typeof args.maxResults === "number" ? args.maxResults : 8;
        result = await runMemorySearchTool(
          this.personaPath,
          String(args.query ?? ""),
          maxResults
        );
      } else if (toolName === "memory.inspect") {
        result = await runMemoryInspectTool(
          this.personaPath,
          String(args.id ?? "")
        );
      }

      await appendLifeEvent(this.personaPath, {
        type: "mcp_tool_called",
        payload: {
          toolName,
          callId,
          callCount: callCount + 1,
          budgetCost: budget.cost,
          sessionMax: budget.sessionMax
        }
      }).catch(() => undefined);
      this.auditLogger?.({
        toolName,
        status: "ok",
        reason: "ok",
        durationMs: Date.now() - startedAt
      });

      return {
        content: [{ type: "text", text: JSON.stringify(result) }]
      } satisfies CallToolResult;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      await appendLifeEvent(this.personaPath, {
        type: "mcp_tool_rejected",
        payload: {
          toolName,
          callId,
          reason: "handler_error",
          error: msg
        }
      }).catch(() => undefined);
      this.auditLogger?.({
        toolName,
        status: "rejected",
        reason: `handler_error:${msg}`,
        durationMs: Date.now() - startedAt
      });
      return errorResult(`handler_error: ${msg}`);
    }
  }
}

export function createTestRegistry(opts: ToolRegistryOptions): ToolRegistry {
  return new ToolRegistry(opts);
}
