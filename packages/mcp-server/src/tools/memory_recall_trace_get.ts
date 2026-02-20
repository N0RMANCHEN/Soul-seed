import { getRecallTraceById } from "@soulseed/core";

export async function runMemoryRecallTraceGetTool(
  personaPath: string,
  traceId: string
): Promise<{ found: boolean; trace: unknown | null }> {
  const id = traceId.trim();
  if (!id) {
    return { found: false, trace: null };
  }
  const trace = await getRecallTraceById(personaPath, id);
  if (!trace) {
    return { found: false, trace: null };
  }
  return {
    found: true,
    trace
  };
}
