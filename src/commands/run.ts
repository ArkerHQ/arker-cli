import type { Arker } from "@arker-ai/sdk";
import { printJson, printError } from "../output.js";

/**
 * arker run <id> <code>
 *
 * Mirrors `Arker.vm(id).run(code, { sessionId, timeout })`. Streams the
 * SDK's `RunResult` to stdout/stderr; exits with the run's exit code.
 */
export async function runCommand(
  arker: Arker,
  positional: string[],
  flags: Record<string, string | boolean>,
): Promise<number> {
  const id = positional[0];
  const code = positional.slice(1).join(" ");
  if (!id || !code) {
    printError("Usage: arker run <id> <code> [--session-id <s>] [--timeout <ms>]");
    return 1;
  }

  const sessionId = typeof flags["session-id"] === "string" ? flags["session-id"] : undefined;
  const timeout = typeof flags.timeout === "string" ? parseInt(flags.timeout, 10) : undefined;

  try {
    const result = await arker.vm(id).run(code, {
      sessionId,
      timeout: timeout !== undefined && !isNaN(timeout) ? timeout : undefined,
    });
    if (flags.json === true) {
      printJson({
        stdout: new TextDecoder().decode(result.stdout),
        stderr: new TextDecoder().decode(result.stderr),
        exitCode: result.exitCode,
        durationMs: result.durationMs,
        sessionId: result.sessionId,
        cwd: result.cwd,
      });
      return 0;
    }
    if (result.stdout.length > 0) process.stdout.write(result.stdout);
    if (result.stderr.length > 0) process.stderr.write(result.stderr);
    return result.exitCode;
  } catch (err: any) {
    printError(`run failed: ${err.message ?? err}`);
    return 1;
  }
}
