import { executeTurnProtocol } from "./execution_protocol.js";
import type { RuntimeStageTrace, RuntimeStageName } from "./runtime_pipeline.js";
import type { ModelAdapter, PersonaPackage } from "./types.js";

export interface PipelineReplayCase {
  userInput: string;
  mode?: "soul" | "agent";
  plannerAdapter?: ModelAdapter;
  expectedStageOrder?: RuntimeStageName[];
  expectedRoute?: "instinct" | "deliberative";
  expectedMode?: "soul" | "agent";
}

export interface PipelineReplayHarnessResult {
  input: string;
  stages: RuntimeStageTrace[];
  route: string | undefined;
  mode: "soul" | "agent";
  pass: boolean;
  mismatches: string[];
}

const DEFAULT_STAGE_ORDER: RuntimeStageName[] = [
  "perception",
  "idea",
  "deliberation",
  "meta_review",
  "commit"
];

export async function runPipelineStageReplayHarness(
  rootPath: string,
  personaPkg: PersonaPackage,
  cases: PipelineReplayCase[],
  opts?: { model?: string }
): Promise<PipelineReplayHarnessResult[]> {
  const model = opts?.model ?? "mock-adapter";
  const results: PipelineReplayHarnessResult[] = [];

  for (const item of cases) {
    const turn = await executeTurnProtocol({
      rootPath,
      personaPkg,
      userInput: item.userInput,
      model,
      lifeEvents: [],
      mode: item.mode ?? "soul",
      plannerAdapter: item.plannerAdapter
    });

    const stages = turn.pipelineStages ?? [];
    const route = turn.trace?.routeDecision;
    const mode = turn.mode;

    const mismatches: string[] = [];
    const expectedOrder = item.expectedStageOrder ?? DEFAULT_STAGE_ORDER;
    const actualOrder = stages.map((s) => s.stage);

    if (JSON.stringify(actualOrder) !== JSON.stringify(expectedOrder)) {
      mismatches.push(
        `stageOrder expected=${JSON.stringify(expectedOrder)} actual=${JSON.stringify(actualOrder)}`
      );
    }

    if (item.expectedRoute !== undefined && route !== item.expectedRoute) {
      mismatches.push(`route expected=${item.expectedRoute} actual=${route}`);
    }

    if (item.expectedMode !== undefined && mode !== item.expectedMode) {
      mismatches.push(`mode expected=${item.expectedMode} actual=${mode}`);
    }

    results.push({
      input: item.userInput,
      stages,
      route,
      mode,
      pass: mismatches.length === 0,
      mismatches
    });
  }

  return results;
}
