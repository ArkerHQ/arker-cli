export interface ParsedArgs {
  command: string | null;
  subcommand: string | null;
  positional: string[];
  flags: Record<string, string | boolean>;
}

/** Flags that never take a value — always treated as boolean true */
const BOOLEAN_FLAGS = new Set([
  "help", "version", "json", "no-color", "exit",
]);

export function parseArgs(argv: string[]): ParsedArgs {
  let command: string | null = null;
  const positional: string[] = [];
  const flags: Record<string, string | boolean> = {};

  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];

    if (arg === "--") {
      positional.push(...argv.slice(i + 1));
      break;
    }

    if (arg.startsWith("--")) {
      i = parseFlag(argv, i, flags);
    } else {
      if (command === null) command = arg;
      else if (command === "run") {
        positional.push(...parseRunPositional(argv.slice(i), flags));
        break;
      } else {
        positional.push(arg);
      }
      i++;
    }
  }

  let subcommand: string | null = null;
  if ((command === "config" || command === "sync") && positional.length > 0) {
    subcommand = positional.shift() ?? null;
  }

  return { command, subcommand, positional, flags };
}

function parseRunPositional(argv: string[], flags: Record<string, string | boolean>): string[] {
  const positional: string[] = [];
  const id = argv[0];
  if (!id) return positional;

  // After the remote command starts, every remaining token belongs to it.
  positional.push(id);
  let i = 1;
  while (i < argv.length) {
    const arg = argv[i];
    if (arg === "--") {
      positional.push(...argv.slice(i + 1));
      break;
    }
    if (arg.startsWith("--")) {
      i = parseFlag(argv, i, flags);
      continue;
    }
    positional.push(...argv.slice(i));
    break;
  }

  return positional;
}

function parseFlag(argv: string[], i: number, flags: Record<string, string | boolean>): number {
  const key = argv[i]!.slice(2);
  const next = argv[i + 1];

  if (BOOLEAN_FLAGS.has(key) || next === undefined || next.startsWith("--")) {
    flags[key] = true;
    return i + 1;
  }

  flags[key] = next;
  return i + 2;
}

export function hasFlag(flags: Record<string, string | boolean>, key: string): boolean {
  return key in flags;
}

export function getFlagString(flags: Record<string, string | boolean>, key: string): string | undefined {
  const val = flags[key];
  if (typeof val !== "string") return undefined;
  return val;
}
