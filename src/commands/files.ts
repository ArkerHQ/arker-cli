import type { Arker } from "@arker-ai/sdk";
import { readFile as readLocalFile } from "node:fs/promises";
import { printError, printJson, printSuccess } from "../output.js";

/**
 * arker read-file <id> <path>
 *
 * Mirrors `Arker.vm(id).sync.readFile(path)`. Bytes go to stdout.
 */
export async function readFileCommand(
  arker: Arker,
  positional: string[],
  flags: Record<string, string | boolean> = {},
): Promise<number> {
  const id = positional[0];
  const path = positional[1];
  if (!id || !path) {
    printError("Usage: arker read-file <id> <path>");
    return 1;
  }
  try {
    const data = await arker.vm(id).sync.readFile(path);
    if (flags.json === true) {
      printJson({ content: Buffer.from(data).toString("base64"), encoding: "base64" });
      return 0;
    }
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
  flags: Record<string, string | boolean> = {},
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
    data = await readStdin();
  } else {
    data = arg;
  }

  try {
    await arker.vm(id).sync.writeFile(path, data);
    if (flags.json === true) printJson({ ok: true });
    return 0;
  } catch (err: any) {
    printError(`write-file failed: ${err.message ?? err}`);
    return 1;
  }
}

export async function syncCommand(
  arker: Arker,
  subcommand: string | null,
  positional: string[],
  flags: Record<string, string | boolean>,
): Promise<number> {
  switch (subcommand) {
    case "read":
      return readFileCommand(arker, positional, flags);
    case "write":
      return syncWriteFileCommand(arker, positional, flags);
    default:
      printError("Usage: arker sync <read|write> ...");
      return 1;
  }
}

async function syncWriteFileCommand(
  arker: Arker,
  positional: string[],
  flags: Record<string, string | boolean>,
): Promise<number> {
  const id = positional[0];
  const remotePath = positional[1];
  const localPath = positional[2];
  if (!id || !remotePath || !localPath) {
    printError("Usage: arker sync write <id> <remote-path> <local-path>");
    return 1;
  }

  try {
    const data = localPath === "-" ? await readStdin() : await readLocalFile(localPath);
    await arker.vm(id).sync.writeFile(remotePath, data);
    if (flags.json === true) {
      printJson({ ok: true });
      return 0;
    }
    printSuccess(`Wrote ${localPath} to ${id}:${remotePath}`);
    return 0;
  } catch (err: any) {
    printError(`sync write failed: ${err.message ?? err}`);
    return 1;
  }
}

async function readStdin(): Promise<Uint8Array> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return new Uint8Array(Buffer.concat(chunks));
}
