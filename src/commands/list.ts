import type { Arker } from "@arker-ai/sdk";
import { printJson, printTable, printField, printInfo, printError } from "../output.js";

/**
 * arker list
 *
 * Mirrors `Arker.list({ limit, offset, q, sort })`.
 */
export async function listCommand(
  arker: Arker,
  flags: Record<string, string | boolean>,
): Promise<number> {
  const limit = typeof flags.limit === "string" ? parseInt(flags.limit, 10) : undefined;
  const offset = typeof flags.offset === "string" ? parseInt(flags.offset, 10) : undefined;
  const q = typeof flags.q === "string" ? flags.q : undefined;
  const sort = typeof flags.sort === "string" ? flags.sort : undefined;
  const field = typeof flags.field === "string" ? flags.field : undefined;

  try {
    const result = await arker.list({ limit, offset, q, sort });
    if (flags.json === true) {
      printJson(result);
      return 0;
    }
    if (field) {
      // --field operates on each item — one value per line
      printField(result.items, field);
      return 0;
    }
    if (result.items.length === 0) {
      printInfo("(no VMs)");
      return 0;
    }
    const rows = result.items.map((v) => [
      v.vm_id,
      v.name ?? "",
      v.base_image,
      v.region,
      v.created_at,
    ]);
    printTable(["ID", "NAME", "BASE", "REGION", "CREATED"], rows);
    return 0;
  } catch (err: any) {
    printError(`list failed: ${err.message ?? err}`);
    return 1;
  }
}
