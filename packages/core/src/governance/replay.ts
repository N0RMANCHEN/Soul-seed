import { decide } from "../runtime/orchestrator.js";
import type { DecisionTrace, LifeEvent, PersonaPackage } from "../types.js";

export interface ReplayResult {
  input: string;
  trace: DecisionTrace;
}

export interface DecisionReplayCase {
  input: string;
  options?: {
    lifeEvents?: LifeEvent[];
    memoryWeights?: {
      activation: number;
      emotion: number;
      narrative: number;
      relational?: number;
    };
    recalledMemories?: string[];
    recallTraceId?: string;
  };
  expected?: {
    askClarifyingQuestion?: boolean;
    refuse?: boolean;
    riskLevel?: "low" | "medium" | "high";
    selectedMemoryIncludes?: string;
  };
}

export interface DecisionReplayHarnessResult extends ReplayResult {
  pass: boolean;
  mismatches: string[];
}

export function runDecisionReplay(
  personaPkg: PersonaPackage,
  model: string,
  userInputs: string[]
): ReplayResult[] {
  return userInputs.map((input) => ({
    input,
    trace: decide(personaPkg, input, model)
  }));
}

export function runDecisionReplayHarness(
  personaPkg: PersonaPackage,
  cases: DecisionReplayCase[],
  options?: {
    model?: string;
  }
): DecisionReplayHarnessResult[] {
  const model = options?.model ?? "mock-adapter";
  return cases.map((item) => {
    const trace = decide(personaPkg, item.input, model, item.options);
    const mismatches: string[] = [];
    const expected = item.expected;

    if (expected) {
      if (
        typeof expected.askClarifyingQuestion === "boolean" &&
        trace.askClarifyingQuestion !== expected.askClarifyingQuestion
      ) {
        mismatches.push(
          `askClarifyingQuestion expected=${expected.askClarifyingQuestion} actual=${trace.askClarifyingQuestion}`
        );
      }
      if (typeof expected.refuse === "boolean" && trace.refuse !== expected.refuse) {
        mismatches.push(`refuse expected=${expected.refuse} actual=${trace.refuse}`);
      }
      if (expected.riskLevel && trace.riskLevel !== expected.riskLevel) {
        mismatches.push(`riskLevel expected=${expected.riskLevel} actual=${trace.riskLevel}`);
      }
      if (
        expected.selectedMemoryIncludes &&
        !trace.selectedMemories.some((entry) => entry.includes(expected.selectedMemoryIncludes as string))
      ) {
        mismatches.push(`selectedMemories missing=${expected.selectedMemoryIncludes}`);
      }
    }

    return {
      input: item.input,
      trace,
      pass: mismatches.length === 0,
      mismatches
    };
  });
}
