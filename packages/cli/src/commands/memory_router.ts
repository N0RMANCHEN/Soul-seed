import type { CommandHandler } from "./types.js";

export const dispatchMemoryCommands: CommandHandler = async (args, deps) => {
  const [resource, action] = args._;

  if (resource === "memory" && action === "compact") {
    await deps.runMemoryCompact(args.options);
    return true;
  }

  if (resource === "memory" && action === "archive") {
    await deps.runMemoryArchive(args.options);
    return true;
  }

  if (resource === "memory" && action === "index") {
    await deps.runMemoryIndex(args._[2], args.options);
    return true;
  }

  if (resource === "memory" && action === "search") {
    await deps.runMemorySearch(args.options);
    return true;
  }

  if (resource === "memory" && action === "eval" && args._[2] === "recall") {
    await deps.runMemoryEvalRecall(args.options);
    return true;
  }

  if (resource === "memory" && action === "eval" && args._[2] === "budget") {
    await deps.runMemoryEvalBudget(args.options);
    return true;
  }

  if (resource === "memory" && action === "recall-trace") {
    await deps.runMemoryRecallTrace(args.options);
    return true;
  }

  if (resource === "memory" && action === "consolidate") {
    await deps.runMemoryConsolidate(args.options);
    return true;
  }

  if (resource === "memory" && action === "learn") {
    await deps.runMemoryLearn(args._[2], args.options);
    return true;
  }

  if (resource === "memory" && action === "status") {
    await deps.runMemoryStatus(args.options);
    return true;
  }

  if (resource === "memory" && action === "list") {
    await deps.runMemoryList(args.options);
    return true;
  }

  if (resource === "memory" && action === "budget") {
    await deps.runMemoryBudget(args.options);
    return true;
  }

  if (resource === "memory" && action === "inspect") {
    await deps.runMemoryInspect(args.options);
    return true;
  }

  if (resource === "memory" && action === "forget") {
    await deps.runMemoryForget(args.options);
    return true;
  }

  if (resource === "memory" && action === "recover") {
    await deps.runMemoryRecover(args.options);
    return true;
  }

  if (resource === "memory" && action === "fiction" && args._[2] === "repair") {
    await deps.runMemoryFictionRepair(args.options);
    return true;
  }

  if (resource === "memory" && action === "unstick") {
    await deps.runMemoryUnstick(args.options);
    return true;
  }

  if (resource === "memory" && action === "export") {
    await deps.runMemoryExport(args.options);
    return true;
  }

  if (resource === "memory" && action === "import") {
    await deps.runMemoryImport(args.options);
    return true;
  }

  if (resource === "memory" && action === "pin") {
    const pinAction = typeof args._[2] === "string" ? args._[2] : undefined;
    if (pinAction === "library") {
      await deps.runPinnedLibrary(args._[3], args.options);
      return true;
    }
    await deps.runMemoryPin(pinAction, args.options);
    return true;
  }

  if (resource === "memory" && action === "unpin") {
    await deps.runMemoryPin("remove", args.options);
    return true;
  }

  if (resource === "memory" && action === "reconcile") {
    await deps.runMemoryReconcile(args.options);
    return true;
  }

  if (resource === "memory" && action === "facts") {
    const factsAction = typeof args._[2] === "string" ? args._[2] : "list";
    await deps.runMemoryFacts(factsAction, args.options);
    return true;
  }

  return false;
};
