import type { Arker } from "@arker-ai/sdk";
import { printJson, printSuccess, printError } from "../output.js";

/**
 * arker fork <id|template>
 *
 * Mirrors `Arker.vm(id).fork({ name, isPublic, region })`. Pass a template
 * alias like `arkuntu` for the create-from-template case.
 */
export async function forkCommand(
  arker: Arker,
  positional: string[],
  flags: Record<string, string | boolean>,
): Promise<number> {
  const id = positional[0];
  if (!id) {
    printError("Usage: arker fork <id|template> [--name <n>] [--region <r>] [--public]");
    return 1;
  }
  const name = typeof flags.name === "string" ? flags.name : undefined;
  const region = typeof flags.region === "string" ? flags.region : undefined;
  const isPublic = flags.public === true;

  try {
    const child = await arker.vm(id).fork({ name, region, isPublic });
    if (flags.json === true) {
      printJson({ id: child.id });
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
