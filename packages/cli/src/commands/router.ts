import type { ParsedArgs } from "../parser/args.js";
import { dispatchMemoryCommands } from "./memory_router.js";
import { dispatchMiscCommands } from "./misc_router.js";
import { dispatchPersonaCommands } from "./persona_router.js";
import type { RouterDeps } from "./types.js";

const ROUTE_HANDLERS = [
  dispatchPersonaCommands,
  dispatchMemoryCommands,
  dispatchMiscCommands
] as const;

export async function dispatchKnownCommand(args: ParsedArgs, deps: RouterDeps): Promise<boolean> {
  for (const handler of ROUTE_HANDLERS) {
    if (await handler(args, deps)) {
      return true;
    }
  }
  return false;
}

export type { RouterDeps } from "./types.js";
