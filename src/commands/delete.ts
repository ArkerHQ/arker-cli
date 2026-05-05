import type { Arker } from "@arker-ai/sdk";
import { printSuccess, printError } from "../output.js";

/**
 * arker delete <id>
 *
 * Mirrors `Arker.vm(id).delete()`.
 */
export async function deleteCommand(
  arker: Arker,
  positional: string[],
  flags: Record<string, string | boolean>,
): Promise<number> {
  const id = positional[0];
  if (!id) {
    printError("Usage: arker delete <id>");
    return 1;
  }
  try {
    await arker.vm(id).delete();
    if (flags.json !== true) printSuccess(`Deleted ${id}`);
    return 0;
  } catch (err: any) {
    printError(`delete failed: ${err.message ?? err}`);
    return 1;
  }
}
