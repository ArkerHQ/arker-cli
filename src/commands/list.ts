import type { Arker } from "@arker-ai/sdk";
import { printJson, printTable, printInfo, printError } from "../output.js";

/**
 * arker list
 *
 * Mirrors `Arker.list()`.
 */
export async function listCommand(
  arker: Arker,
  flags: Record<string, string | boolean>,
): Promise<number> {
  try {
    const result = await arker.list();
    if (flags.json === true) {
      printJson(result);
      return 0;
    }
    if (result.vms.length === 0) {
      printInfo("(no VMs)");
      return 0;
    }
    const rows = result.vms.map((v) => [
      v.vm_id,
      v.name ?? "",
      v.state,
      v.source_golden ?? "",
      v.created_at,
    ]);
    printTable(["ID", "NAME", "STATE", "SOURCE", "CREATED"], rows);
    return 0;
  } catch (err: any) {
    printError(`list failed: ${err.message ?? err}`);
    return 1;
  }
}
