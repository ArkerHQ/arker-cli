import type { Arker } from "@arker-ai/sdk";
import { printError } from "../output.js";

/**
 * arker read-file <id> <path>
 *
 * Mirrors `Arker.vm(id).sync.readFile(path)`. Bytes go to stdout.
 */
export async function readFileCommand(
  arker: Arker,
  positional: string[],
): Promise<number> {
  const id = positional[0];
  const path = positional[1];
  if (!id || !path) {
    printError("Usage: arker read-file <id> <path>");
    return 1;
  }
  try {
    const data = await arker.vm(id).sync.readFile(path);
    process.stdout.write(data);
    return 0;
  } catch (err: any) {
    printError(`read-file failed: ${err.message ?? err}`);
    return 1;
  }
}

/**
 * arker write-file <id> <path> [data | -]
 *
 * Mirrors `Arker.vm(id).sync.writeFile(path, data)`. If data is "-" or
 * omitted, reads from stdin.
 */
export async function writeFileCommand(
  arker: Arker,
  positional: string[],
): Promise<number> {
  const id = positional[0];
  const path = positional[1];
  if (!id || !path) {
    printError("Usage: arker write-file <id> <path> [data | -]");
    return 1;
  }

  let data: Uint8Array | string;
  const arg = positional[2];
  if (arg === undefined || arg === "-") {
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
    data = new Uint8Array(Buffer.concat(chunks));
  } else {
    data = arg;
  }

  try {
    await arker.vm(id).sync.writeFile(path, data);
    return 0;
  } catch (err: any) {
    printError(`write-file failed: ${err.message ?? err}`);
    return 1;
  }
}
