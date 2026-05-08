import type { Arker, RunResult } from "@arker-ai/sdk";
import { printInfo, printJson, printError } from "../output.js";

/**
 * arker run <id> <code>
 *
 * Mirrors `Arker.vm(id).run(code, { session_id, timeout })`.
 */
export async function runCommand(
  arker: Arker,
  positional: string[],
  flags: Record<string, string | boolean>,
): Promise<number> {
  const id = positional[0];
  const code = positional.slice(1).join(" ");
  if (!id || !code) {
    printError("Usage: arker run <id> [--session-id <s>] [--timeout <ms>] <code>");
    return 1;
  }

  const sessionId = typeof flags["session-id"] === "string" ? flags["session-id"] : undefined;
  const timeout = parseOptionalNumber(flags.timeout);
  if (timeout === null) {
    printError("Invalid --timeout value; expected milliseconds.");
    return 1;
  }

  try {
    const result = await arker.vm(id).run(code, {
      session_id: sessionId,
      timeout,
    });
    if (flags.json === true) {
      printJson(runResultForJson(result));
      return result.type === "completed" ? result.exitCode : 0;
    }
    return printHumanRunResult(result);
  } catch (err: any) {
    printError(`run failed: ${err.message ?? err}`);
    return 1;
  }
}

function printHumanRunResult(result: RunResult): number {
  switch (result.type) {
    case "completed":
      if (result.stdout.length > 0) process.stdout.write(result.stdout);
      if (result.stderr.length > 0) process.stderr.write(result.stderr);
      return result.exitCode;
    case "background":
      printInfo(`Background run ${result.completed ? "completed" : "started"}`);
      console.log(result.runId);
      return 0;
    case "pty":
      console.log(`session_id: ${result.sessionId}`);
      console.log(`ws_url: ${result.wsUrl}`);
      return 0;
  }
}

function runResultForJson(result: RunResult): unknown {
  switch (result.type) {
    case "completed":
      return {
        type: result.type,
        completed: result.completed,
        stdout: new TextDecoder().decode(result.stdout),
        stdoutEncoding: result.stdoutEncoding,
        stderr: new TextDecoder().decode(result.stderr),
        stderrEncoding: result.stderrEncoding,
        exitCode: result.exitCode,
      };
    case "background":
      return result;
    case "pty":
      return result;
  }
}

function parseOptionalNumber(value: string | boolean | undefined): number | undefined | null {
  if (value === undefined) return undefined;
  if (typeof value !== "string") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
