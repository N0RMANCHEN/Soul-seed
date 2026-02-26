import type { CommandHandler } from "./types.js";

export const dispatchMiscCommands: CommandHandler = async (args, deps) => {
  const [resource, action] = args._;

  if (resource === "cognition" && action === "adapt-routing") {
    await deps.runCognitionAdaptRouting(args.options);
    return true;
  }

  if (resource === "finetune" && action === "export-dataset") {
    await deps.runFinetuneExportDataset(args.options);
    return true;
  }

  if (resource === "examples") {
    await deps.runExamples(action ?? "list", args.options);
    return true;
  }

  if (resource === "mcp") {
    await deps.runMcp(args.options);
    return true;
  }

  if (resource === "refine") {
    await deps.runRefine(action, args.options);
    return true;
  }

  if (resource === "social") {
    await deps.runSocial(action, args.options);
    return true;
  }

  if (resource === "doctor") {
    await deps.runDoctor(args.options);
    return true;
  }

  if (resource === "goal") {
    await deps.runGoal(action, args.options);
    return true;
  }

  if (resource === "agent") {
    await deps.runAgentCommand(action, args.options);
    return true;
  }

  if (resource === "trace") {
    await deps.runTrace(action, args.options);
    return true;
  }

  if (resource === "explain") {
    await deps.runExplain(action, args.options);
    return true;
  }

  if (resource === "space") {
    await deps.runSharedSpaceCommand(action, args.options);
    return true;
  }

  return false;
};
