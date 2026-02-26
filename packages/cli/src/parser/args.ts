export interface ParsedArgs {
  _: string[];
  options: Record<string, string | boolean>;
}

export function parseArgs(argv: string[]): ParsedArgs {
  const parsed: ParsedArgs = { _: [], options: {} };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token.startsWith("--")) {
      const key = token.slice(2);
      const next = argv[i + 1];
      if (!next || next.startsWith("--")) {
        parsed.options[key] = true;
      } else {
        parsed.options[key] = next;
        i += 1;
      }
    } else {
      parsed._.push(token);
    }
  }

  return parsed;
}
