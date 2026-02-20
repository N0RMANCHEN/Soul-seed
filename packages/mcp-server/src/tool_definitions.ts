export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required: string[];
  };
}

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: "persona.get_context",
    description:
      "Prepare persona context for an external LLM. Returns systemPrompt, recentConversation, selected memories, and decision metadata. Does NOT call any LLM — the calling agent is responsible for generation. If refuse=true, the request was blocked by policy and no life.log entry is written.",
    inputSchema: {
      type: "object",
      properties: {
        userInput: {
          type: "string",
          description: "The user's message to build context for."
        },
        maxMemories: {
          type: "integer",
          description: "Maximum number of memories to inject (default: 8).",
          minimum: 1,
          maximum: 50
        }
      },
      required: ["userInput"]
    }
  },
  {
    name: "conversation.save_turn",
    description:
      "Persist a completed conversation turn to life.log after the external LLM has generated a reply. Applies identity, relational, and recall-grounding guards before writing. Pass the selectedMemories array returned by persona.get_context so guards have full context.",
    inputSchema: {
      type: "object",
      properties: {
        userMessage: {
          type: "string",
          description: "The user's message for this turn."
        },
        assistantMessage: {
          type: "string",
          description: "The assistant's generated reply to persist."
        },
        selectedMemories: {
          type: "array",
          items: { type: "string" },
          description:
            "Memory strings returned by persona.get_context (e.g. 'life=...', 'pinned=...'). Used by guards for grounding checks."
        }
      },
      required: ["userMessage", "assistantMessage"]
    }
  },
  {
    name: "session.capability_list",
    description:
      "List unified session capability contracts (name/risk/owner-only/confirmation) shared across channels.",
    inputSchema: {
      type: "object",
      properties: {},
      required: []
    }
  },
  {
    name: "session.capability_call",
    description:
      "Call a unified session capability. Supports either direct capability name + input or free-text intent text.",
    inputSchema: {
      type: "object",
      properties: {
        capability: {
          type: "string",
          description: "Capability name, e.g. session.read_file or session.exit."
        },
        text: {
          type: "string",
          description: "Free text for rule-first intent detection."
        },
        input: {
          type: "object",
          description: "Capability arguments payload."
        }
      },
      required: []
    }
  },
  {
    name: "memory.search",
    description: "Search the persona's memory store using a text query. Returns ranked results.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The search query string."
        },
        maxResults: {
          type: "integer",
          description: "Maximum number of results to return (default: 8).",
          minimum: 1,
          maximum: 50
        }
      },
      required: ["query"]
    }
  },
  {
    name: "memory.search_hybrid",
    description:
      "Search persona memory with Hybrid RAG (FTS + vector + salience fusion) and return ranked results with scores.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The search query string."
        },
        maxResults: {
          type: "integer",
          description: "Maximum number of results to return (default: 12).",
          minimum: 1,
          maximum: 100
        },
        debugTrace: {
          type: "boolean",
          description: "Whether to include full recall trace payload in response."
        }
      },
      required: ["query"]
    }
  },
  {
    name: "memory.recall_trace_get",
    description: "Read a recall trace by trace ID for debugging. Read-only.",
    inputSchema: {
      type: "object",
      properties: {
        traceId: {
          type: "string",
          description: "Recall trace ID returned by memory.search or memory.search_hybrid."
        }
      },
      required: ["traceId"]
    }
  },
  {
    name: "memory.inspect",
    description:
      "Retrieve a single memory record by its ID. Read-only, does not write to life.log.",
    inputSchema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "The memory record ID to inspect."
        }
      },
      required: ["id"]
    }
  }
];
