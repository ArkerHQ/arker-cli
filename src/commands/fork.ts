import type { Arker } from "@arker-ai/sdk";
import { printJson, printSuccess, printError } from "../output.js";

/**
 * arker fork <source>
 *
 * Mirrors `Arker.vm(id).fork({ name })`.
 */
export async function forkCommand(
  arker: Arker,
  positional: string[],
  flags: Record<string, string | boolean>,
): Promise<number> {
  const id = positional[0];
  if (!id) {
    printError("Usage: arker fork <source> [--name <name>]");
    return 1;
  }
  const name = typeof flags.name === "string" ? flags.name : undefined;

  try {
    const child = await arker.vm(id).fork({ name });
    const result = { id: child.id };
    if (flags.json === true) {
      printJson(result);
      return 0;
    }
    printSuccess(`Forked ${id} → ${child.id}`);
    console.log(child.id);
    return 0;
  } catch (err: any) {
    printError(`fork failed: ${err.message ?? err}`);
    return 1;
  }
}
