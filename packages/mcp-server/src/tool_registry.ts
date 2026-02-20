import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { appendLifeEvent } from "@soulseed/core";
import { listCapabilityDefinitions, resolveCapabilityIntent, evaluateCapabilityPolicy } from "@soulseed/core";
import type { PersonaPackage } from "@soulseed/core";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { runPersonaContextTool } from "./tools/persona_context.js";
import { runConversationSaveTool } from "./tools/conversation_save.js";
import { runMemorySearchTool } from "./tools/memory_search.js";
import { runMemorySearchHybridTool } from "./tools/memory_search_hybrid.js";
import { runMemoryRecallTraceGetTool } from "./tools/memory_recall_trace_get.js";
import { runMemoryInspectTool } from "./tools/memory_inspect.js";
import {
  runAgentRunTool,
  runConsistencyInspectTool,
  runGoalCancelTool,
  runGoalCreateTool,
  runGoalGetTool,
  runGoalListTool,
  runRuntimeGoalResumeTool,
  runRuntimeTraceGetTool,
  runRuntimeTurnTool,
  runTraceGetTool
} from "./tools/goal_tools.js";

interface ToolBudget {
  cost: number;
  sessionMax: number;
}

const TOOL_BUDGET: Record<string, ToolBudget> = {
  "persona.get_context":    { cost: 2, sessionMax: 50 },
  "conversation.save_turn": { cost: 2, sessionMax: 50 },
  "session.capability_list": { cost: 1, sessionMax: 200 },
  "session.capability_call": { cost: 1, sessionMax: 200 },
  "memory.search":          { cost: 1, sessionMax: 50 },
  "memory.search_hybrid":   { cost: 1, sessionMax: 50 },
  "memory.recall_trace_get": { cost: 1, sessionMax: 100 },
  "memory.inspect":         { cost: 1, sessionMax: 100 },
  "goal.create":            { cost: 1, sessionMax: 100 },
  "goal.list":              { cost: 1, sessionMax: 200 },
  "goal.get":               { cost: 1, sessionMax: 200 },
  "goal.cancel":            { cost: 1, sessionMax: 100 },
  "agent.run":              { cost: 2, sessionMax: 100 },
  "consistency.inspect":    { cost: 1, sessionMax: 200 },
  "trace.get":              { cost: 1, sessionMax: 200 },
  "runtime.turn":           { cost: 2, sessionMax: 200 },
  "runtime.goal.resume":    { cost: 2, sessionMax: 200 },
  "runtime.trace.get":      { cost: 1, sessionMax: 200 }
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
  private readonly approvedReadPaths = new Set<string>();
  private ownerAuthExpiresAtMs = 0;
  private strictMemoryGrounding = true;
  private adultSafety = {
    adultMode: true,
    ageVerified: true,
    explicitConsent: true,
    fictionalRoleplay: true
  };
  private curiosity = 0.22;
  private annoyanceBias = 0;
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
      } else if (toolName === "session.capability_list") {
        result = {
          items: listCapabilityDefinitions()
        };
      } else if (toolName === "session.capability_call") {
        const requestedName = typeof args.capability === "string" ? args.capability.trim() : "";
        const text = typeof args.text === "string" ? args.text.trim() : "";
        const input = (typeof args.input === "object" && args.input !== null
          ? (args.input as Record<string, unknown>)
          : {}) as Record<string, unknown>;
        const resolved = requestedName
          ? {
              matched: true,
              confidence: 1,
              reason: "explicit_capability",
              request: {
                name: requestedName as
                  | "session.capability_discovery"
                  | "session.show_modes"
                  | "session.owner_auth"
                  | "session.read_file"
                  | "session.proactive_status"
                  | "session.proactive_tune"
                  | "session.set_mode"
                  | "session.exit",
                input,
                source: "mcp" as const
              }
            }
          : resolveCapabilityIntent(text);
        if (!resolved.matched || !resolved.request) {
          result = {
            ok: false,
            status: "clarify",
            message: "no_capability_matched"
          };
        } else {
          if (
            resolved.request.name === "session.set_mode" &&
            typeof resolved.request.input?.ownerToken !== "string" &&
            this.ownerAuthExpiresAtMs > Date.now() &&
            process.env.SOULSEED_OWNER_KEY
          ) {
            resolved.request.input = {
              ...(resolved.request.input ?? {}),
              ownerToken: process.env.SOULSEED_OWNER_KEY
            };
          }
          const guard = evaluateCapabilityPolicy(
            {
              ...resolved.request,
              source: "mcp"
            },
            {
              cwd: process.cwd(),
              ownerKey: process.env.SOULSEED_OWNER_KEY,
              ownerSessionAuthorized: this.ownerAuthExpiresAtMs > Date.now(),
              approvedReadPaths: this.approvedReadPaths
            }
          );
          if (guard.status === "confirm_required") {
            result = {
              ok: false,
              status: "confirm_required",
              capability: guard.capability,
              reason: guard.reason,
              input: guard.normalizedInput
            };
          } else if (guard.status === "rejected") {
            result = {
              ok: false,
              status: "rejected",
              capability: guard.capability,
              reason: guard.reason
            };
          } else if (guard.capability === "session.capability_discovery") {
            result = {
              ok: true,
              status: "executed",
              capability: guard.capability,
              items: listCapabilityDefinitions()
            };
          } else if (guard.capability === "session.show_modes") {
            result = {
              ok: true,
              status: "executed",
              capability: guard.capability,
              output: {
                strict_memory_grounding: this.strictMemoryGrounding,
                adult_mode: this.adultSafety.adultMode,
                age_verified: this.adultSafety.ageVerified,
                explicit_consent: this.adultSafety.explicitConsent,
                fictional_roleplay: this.adultSafety.fictionalRoleplay
              }
            };
          } else if (guard.capability === "session.owner_auth") {
            this.ownerAuthExpiresAtMs = Date.now() + 15 * 60_000;
            result = {
              ok: true,
              status: "executed",
              capability: guard.capability,
              output: {
                expiresAt: new Date(this.ownerAuthExpiresAtMs).toISOString()
              }
            };
          } else if (guard.capability === "session.read_file") {
            const filePath = String(guard.normalizedInput.path ?? "");
            const content = await readFile(filePath, "utf8");
            this.approvedReadPaths.add(filePath);
            result = {
              ok: true,
              status: "executed",
              capability: guard.capability,
              path: filePath,
              size: Buffer.byteLength(content, "utf8"),
              content
            };
          } else if (guard.capability === "session.set_mode") {
            const modeKey = String(guard.normalizedInput.modeKey ?? "");
            const modeValue = Boolean(guard.normalizedInput.modeValue);
            this.ownerAuthExpiresAtMs = Date.now() + 15 * 60_000;
            if (modeKey === "strict_memory_grounding") {
              this.strictMemoryGrounding = modeValue;
            } else if (modeKey === "adult_mode") {
              this.adultSafety.adultMode = modeValue;
            } else if (modeKey === "age_verified") {
              this.adultSafety.ageVerified = modeValue;
            } else if (modeKey === "explicit_consent") {
              this.adultSafety.explicitConsent = modeValue;
            } else if (modeKey === "fictional_roleplay") {
              this.adultSafety.fictionalRoleplay = modeValue;
            }
            result = {
              ok: true,
              status: "executed",
              capability: guard.capability,
              applied: true,
              output: {
                modeKey,
                modeValue,
                strict_memory_grounding: this.strictMemoryGrounding,
                adult_mode: this.adultSafety.adultMode
              }
            };
          } else if (guard.capability === "session.proactive_status") {
            result = {
              ok: true,
              status: "executed",
              capability: guard.capability,
              output: {
                curiosity: this.curiosity,
                annoyanceBias: this.annoyanceBias
              }
            };
          } else if (guard.capability === "session.proactive_tune") {
            const action = String(guard.normalizedInput.action ?? "").toLowerCase();
            result = {
              ok: true,
              status: "executed",
              capability: guard.capability,
              output: {
                action,
                selfDetermined: true,
                curiosity: this.curiosity,
                annoyanceBias: this.annoyanceBias
              }
            };
          } else if (guard.capability === "session.exit") {
            result = {
              ok: true,
              status: "executed",
              capability: guard.capability,
              message: "exit acknowledged"
            };
          }
        }
      } else if (toolName === "memory.search") {
        const maxResults = typeof args.maxResults === "number" ? args.maxResults : 8;
        result = await runMemorySearchTool(
          this.personaPath,
          String(args.query ?? ""),
          maxResults
        );
      } else if (toolName === "memory.search_hybrid") {
        const maxResults = typeof args.maxResults === "number" ? args.maxResults : 12;
        result = await runMemorySearchHybridTool(
          this.personaPath,
          String(args.query ?? ""),
          maxResults,
          args.debugTrace === true
        );
      } else if (toolName === "memory.recall_trace_get") {
        result = await runMemoryRecallTraceGetTool(
          this.personaPath,
          String(args.traceId ?? "")
        );
      } else if (toolName === "memory.inspect") {
        result = await runMemoryInspectTool(
          this.personaPath,
          String(args.id ?? "")
        );
      } else if (toolName === "goal.create") {
        result = await runGoalCreateTool(this.personaPath, {
          title: String(args.title ?? ""),
          summary: typeof args.summary === "string" ? args.summary : undefined,
          source:
            args.source === "user" || args.source === "system" || args.source === "mcp"
              ? args.source
              : "mcp"
        });
      } else if (toolName === "goal.list") {
        result = await runGoalListTool(this.personaPath, {
          status: typeof args.status === "string" ? args.status : undefined,
          limit: typeof args.limit === "number" ? args.limit : undefined
        });
      } else if (toolName === "goal.get") {
        result = await runGoalGetTool(this.personaPath, {
          goalId: String(args.goalId ?? "")
        });
      } else if (toolName === "goal.cancel") {
        result = await runGoalCancelTool(this.personaPath, {
          goalId: String(args.goalId ?? "")
        });
      } else if (toolName === "agent.run") {
        result = await runAgentRunTool(this.personaPath, {
          userInput: String(args.userInput ?? ""),
          goalId: typeof args.goalId === "string" ? args.goalId : undefined,
          maxSteps: typeof args.maxSteps === "number" ? args.maxSteps : undefined
        });
      } else if (toolName === "consistency.inspect") {
        result = await runConsistencyInspectTool(this.personaPath, {
          goalId: typeof args.goalId === "string" ? args.goalId : undefined,
          limit: typeof args.limit === "number" ? args.limit : undefined
        });
      } else if (toolName === "trace.get") {
        result = await runTraceGetTool(this.personaPath, {
          traceId: String(args.traceId ?? "")
        });
      } else if (toolName === "runtime.turn") {
        result = await runRuntimeTurnTool(this.personaPath, {
          userInput: String(args.userInput ?? ""),
          mode: args.mode === "soul" || args.mode === "agent" ? args.mode : "auto",
          model: typeof args.model === "string" ? args.model : undefined,
          maxSteps: typeof args.maxSteps === "number" ? args.maxSteps : undefined
        });
      } else if (toolName === "runtime.goal.resume") {
        result = await runRuntimeGoalResumeTool(this.personaPath, {
          goalId: typeof args.goalId === "string" ? args.goalId : undefined,
          userInput: typeof args.userInput === "string" ? args.userInput : undefined,
          model: typeof args.model === "string" ? args.model : undefined,
          maxSteps: typeof args.maxSteps === "number" ? args.maxSteps : undefined
        });
      } else if (toolName === "runtime.trace.get") {
        result = await runRuntimeTraceGetTool(this.personaPath, {
          traceId: String(args.traceId ?? "")
        });
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
