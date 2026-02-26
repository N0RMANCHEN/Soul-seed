import type { CommandHandler } from "./types.js";

export const dispatchPersonaCommands: CommandHandler = async (args, deps) => {
  const [resource, action] = args._;

  if (resource === "new") {
    await deps.runPersonaNew(action, args.options);
    return true;
  }

  if (resource === "init") {
    await deps.runPersonaInit(args.options);
    return true;
  }

  if (resource === "rename") {
    await deps.runRename(args.options);
    return true;
  }

  if (resource === "persona" && action === "init") {
    await deps.runPersonaInit(args.options);
    return true;
  }

  if (resource === "persona" && action === "rename") {
    await deps.runRename(args.options);
    return true;
  }

  if (resource === "persona" && action === "reproduce") {
    await deps.runPersonaReproduce(args.options);
    return true;
  }

  if (resource === "persona" && action === "inspect") {
    await deps.runPersonaInspect(args.options);
    return true;
  }

  if (resource === "persona" && action === "lint") {
    await deps.runPersonaLint(args.options);
    return true;
  }

  if (resource === "persona" && action === "compile") {
    await deps.runPersonaCompile(args.options);
    return true;
  }

  if (resource === "persona" && action === "export") {
    await deps.runPersonaExport(args.options);
    return true;
  }

  if (resource === "persona" && action === "import") {
    await deps.runPersonaImport(args.options);
    return true;
  }

  if (resource === "persona" && action === "model-routing") {
    await deps.runPersonaModelRouting(args.options);
    return true;
  }

  if (resource === "persona" && action === "voice-phrases") {
    await deps.runPersonaVoicePhrases(args._[2], args.options);
    return true;
  }

  if (resource === "persona" && action === "mood") {
    await deps.runPersonaMood(args._[2], args.options);
    return true;
  }

  if (resource === "persona" && action === "autobiography") {
    await deps.runPersonaAutobiography(args._[2], args.options);
    return true;
  }

  if (resource === "persona" && action === "interests") {
    await deps.runPersonaInterests(args._[2], args.options);
    return true;
  }

  if (resource === "persona" && action === "dates") {
    await deps.runPersonaDates(args._[2], args.options);
    return true;
  }

  if (resource === "persona" && action === "reflect") {
    await deps.runPersonaReflect(args._[2], args.options);
    return true;
  }

  if (resource === "persona" && action === "arc") {
    await deps.runPersonaArc(args.options);
    return true;
  }

  if (resource === "persona" && action === "consent-mode") {
    await deps.runPersonaConsentMode(args._[2], args.options);
    return true;
  }

  if (resource === "persona" && action === "identity") {
    await deps.runPersonaIdentity(args.options);
    return true;
  }

  if (resource === "chat") {
    console.log("提示：推荐新入口 `./ss <name>` 直接聊天。");
    await deps.runChat(args.options);
    return true;
  }

  return false;
};
