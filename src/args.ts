export interface ParsedArgs {
  command: string | null;
  subcommand: string | null;
  positional: string[];
  flags: Record<string, string | boolean>;
}

/** Flags that never take a value — always treated as boolean true */
const BOOLEAN_FLAGS = new Set([
  "help", "version", "json", "no-color", "public",
]);

/**
 * Parse CLI arguments into structured form.
 *
 * Input is process.argv.slice(2) — just the user-provided args.
 *
 * Flags: --key value (string), --flag (boolean true)
 * Positional: everything else after command/subcommand
 *
 * Only `config` carries a subcommand (set/get/unset); every other CLI
 * verb mirrors a single SDK method.
 */
export function parseArgs(argv: string[]): ParsedArgs {
  if (argv.length === 0) {
    return { command: null, subcommand: null, positional: [], flags: {} };
  }

  // If first arg is a flag, there's no command — parse everything as flags/positional
  if (argv[0].startsWith("-")) {
    const result: ParsedArgs = { command: null, subcommand: null, positional: [], flags: {} };
    let i = 0;
    while (i < argv.length) {
      const arg = argv[i];
      if (arg.startsWith("--")) {
        const key = arg.slice(2);
        const next = argv[i + 1];
        if (BOOLEAN_FLAGS.has(key) || next === undefined || next.startsWith("--")) {
          result.flags[key] = true;
          i++;
        } else {
          result.flags[key] = next;
          i += 2;
        }
      } else {
        result.positional.push(arg);
        i++;
      }
    }
    return result;
  }

  const command = argv[0];
  let subcommand: string | null = null;
  let startIdx = 1;

  // Only `config` has subcommands. Treat the second arg as a subcommand
  // when it doesn't look like a flag.
  if (command === "config" && argv.length > 1 && !argv[1].startsWith("-")) {
    subcommand = argv[1];
    startIdx = 2;
  }

  const positional: string[] = [];
  const flags: Record<string, string | boolean> = {};

  let i = startIdx;
  while (i < argv.length) {
    const arg = argv[i];

    if (arg === "--") {
      // Everything after -- is positional
      positional.push(...argv.slice(i + 1));
      break;
    }

    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = argv[i + 1];

      // Boolean flags never consume the next arg
      if (BOOLEAN_FLAGS.has(key) || next === undefined || next.startsWith("--")) {
        flags[key] = true;
        i++;
      } else {
        flags[key] = next;
        i += 2;
      }
    } else {
      positional.push(arg);
      i++;
    }
  }

  return { command, subcommand, positional, flags };
}

export function hasFlag(flags: Record<string, string | boolean>, key: string): boolean {
  return key in flags;
}

export function getFlagString(flags: Record<string, string | boolean>, key: string): string | undefined {
  const val = flags[key];
  if (typeof val !== "string") return undefined;
  return val;
}
