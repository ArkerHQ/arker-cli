import { createInterface } from "node:readline";
import type { Arker, RunResult } from "@arker-ai/sdk";
import { printError, printInfo } from "../output.js";

interface ShellState {
  arker: Arker;
  vmId: string;
  sessionId: string;
  timeout: number | undefined;
  remoteHome: string;
  cwd: string;
  inFlight: boolean;
}

/**
 * arker shell <id>
 *
 * Interactive shell over `Arker.vm(id).run`. Each line is one `run` call,
 * scoped to a generated session_id so cd/export/etc. persist.
 */
export async function shellCommand(
  arker: Arker,
  positional: string[],
  flags: Record<string, string | boolean>,
): Promise<number> {
  const vmId = positional[0];
  if (!vmId) {
    printError("Usage: arker shell <vm-id>");
    return 1;
  }

  const timeout = parseOptionalNumber(flags.timeout);
  if (timeout === null) {
    printError("Invalid --timeout value; expected milliseconds.");
    return 1;
  }

  let sessionId: string;
  try {
    sessionId = await createSession(arker, vmId);
  } catch (err: any) {
    printError(`shell failed to start: could not create session: ${err.message ?? err}`);
    return 1;
  }

  try {
    let initial: { home: string; cwd: string; motd: string };
    try {
      initial = await fetchInit(arker, vmId, sessionId, timeout);
    } catch (err: any) {
      printError(`shell failed to start: ${err.message ?? err}`);
      return 1;
    }

    process.stderr.write(`Shell session ${sessionId} started\n\n`);

    if (initial.motd.length > 0) {
      process.stderr.write(initial.motd);
      if (!initial.motd.endsWith("\n")) process.stderr.write("\n");
    }

    return await runShellLoop({
      arker,
      vmId,
      sessionId,
      timeout,
      remoteHome: initial.home,
      cwd: initial.cwd,
      inFlight: false,
    });
  } finally {
    // Best-effort cleanup. Don't drown the user in noise if the VM is already gone.
    await deleteSession(arker, vmId, sessionId).catch(() => {});
  }
}

async function createSession(arker: Arker, vmId: string): Promise<string> {
  const vm = arker.vm(vmId);
  const resp = await arker._request<{ session_id: string }>(
    "POST",
    `/v1/vms/${encodeURIComponent(vmId)}/sessions`,
    {},
    vm.baseUrl,
  );
  return resp.session_id;
}

async function deleteSession(arker: Arker, vmId: string, sessionId: string): Promise<void> {
  const vm = arker.vm(vmId);
  await arker._request(
    "DELETE",
    `/v1/vms/${encodeURIComponent(vmId)}/sessions/${encodeURIComponent(sessionId)}`,
    undefined,
    vm.baseUrl,
  );
}

async function runShellLoop(state: ShellState): Promise<number> {
  const isTTY = !!process.stdin.isTTY;
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: isTTY,
  });

  const refreshPrompt = () => {
    if (!isTTY) return;
    rl.setPrompt(buildPrompt(state));
    rl.prompt();
  };

  rl.on("SIGINT", () => {
    if (state.inFlight) {
      // v1 cannot cancel an in-flight remote command; surface the keypress and
      // let the run complete (or hit --timeout).
      process.stderr.write("^C\n");
      return;
    }
    process.stdout.write("^C\n");
    // Simulate Ctrl+U to clear readline's in-progress input buffer.
    rl.write(null, { ctrl: true, name: "u" });
    refreshPrompt();
  });

  let exitCode = 0;
  refreshPrompt();

  try {
    for await (const rawLine of rl) {
      const trimmed = rawLine.trim();

      if (trimmed === "") {
        refreshPrompt();
        continue;
      }

      if (trimmed === "exit") {
        break;
      }

      state.inFlight = true;
      try {
        await runUserCommand(state, rawLine);
      } catch (err: any) {
        if (classifyError(err, state.vmId) === "fatal") {
          printError(`shell ended: ${err.message ?? err}`);
          exitCode = 1;
          state.inFlight = false;
          break;
        }
        printError(`error: ${err.message ?? err}`);
      }

      try {
        const newCwd = await fetchCwd(state.arker, state.vmId, state.sessionId, state.timeout);
        state.cwd = newCwd;
      } catch (err: any) {
        if (classifyError(err, state.vmId) === "fatal") {
          printError(`shell ended: ${err.message ?? err}`);
          exitCode = 1;
          state.inFlight = false;
          break;
        }
        // Recoverable: keep last-known cwd; prompt may be stale until next refresh.
      }

      state.inFlight = false;
      refreshPrompt();
    }
  } finally {
    rl.close();
  }

  printInfo("Shell session ended");
  return exitCode;
}

async function runUserCommand(state: ShellState, line: string): Promise<void> {
  const result = await state.arker.vm(state.vmId).run(line, {
    session_id: state.sessionId,
    timeout: state.timeout,
  });
  writeCompletedToTty(result);
}

function writeCompletedToTty(result: RunResult): void {
  if (result.type !== "completed") {
    printInfo(`(${result.type} run — not displayed in shell mode)`);
    return;
  }
  if (result.stdout.length > 0) process.stdout.write(result.stdout);
  if (result.stderr.length > 0) process.stderr.write(result.stderr);
  // Ensure the next prompt starts on a fresh line.
  const lastOut = result.stdout.length > 0 ? result.stdout[result.stdout.length - 1] : undefined;
  const lastErr = result.stderr.length > 0 ? result.stderr[result.stderr.length - 1] : undefined;
  const tail = lastErr ?? lastOut;
  if (tail !== undefined && tail !== 0x0a) {
    process.stdout.write("\n");
  }
}

const MOTD_SENTINEL = "__ARKER_MOTD__";

async function fetchInit(
  arker: Arker,
  vmId: string,
  sessionId: string,
  timeout: number | undefined,
): Promise<{ home: string; cwd: string; motd: string }> {
  // Single round trip: print home + cwd + sentinel, then the MOTD. Splitting
  // on the sentinel separates the fields we need to parse from arbitrary
  // motd text. `|| true` keeps a missing /etc/motd or update-motd.d from
  // failing the whole run.
  const cmd =
    `printf '%s\\n%s\\n${MOTD_SENTINEL}\\n' "$HOME" "$(pwd -P)"; ` +
    `{ cat /etc/motd 2>/dev/null; run-parts /etc/update-motd.d/ 2>/dev/null; } || true`;
  const result = await arker.vm(vmId).run(cmd, { session_id: sessionId, timeout });
  if (result.type !== "completed") {
    throw new Error(`unexpected run type from shell init: ${result.type}`);
  }
  const text = new TextDecoder().decode(result.stdout);
  const sentinel = `\n${MOTD_SENTINEL}\n`;
  const idx = text.indexOf(sentinel);
  const head = idx === -1 ? text : text.slice(0, idx);
  const motd = idx === -1 ? "" : text.slice(idx + sentinel.length);
  const lines = head.split("\n");
  const home = lines[0] ?? "";
  const cwd = lines[1] ?? "";
  if (!cwd) {
    throw new Error(`could not parse home/cwd from init output: ${JSON.stringify(text)}`);
  }
  return { home, cwd, motd };
}

async function fetchCwd(
  arker: Arker,
  vmId: string,
  sessionId: string,
  timeout: number | undefined,
): Promise<string> {
  const result = await arker.vm(vmId).run("pwd -P", {
    session_id: sessionId,
    timeout,
  });
  if (result.type !== "completed") {
    throw new Error(`unexpected run type from pwd refresh: ${result.type}`);
  }
  const cwd = new TextDecoder().decode(result.stdout).trim();
  if (!cwd) throw new Error("pwd refresh returned empty output");
  return cwd;
}

export function buildPrompt(state: Pick<ShellState, "vmId" | "cwd" | "remoteHome">): string {
  return `arker@${shortVmId(state.vmId)}:${displayPath(state.cwd, state.remoteHome)}$ `;
}

export function shortVmId(id: string): string {
  return id.length <= 6 ? id : id.slice(-6);
}

export function displayPath(cwd: string, home: string): string {
  if (!home) return cwd;
  if (cwd === home) return "~";
  if (cwd.startsWith(home + "/")) return "~" + cwd.slice(home.length);
  return cwd;
}

export function classifyError(err: unknown, vmId: string): "fatal" | "recoverable" {
  const msg = String((err as any)?.message ?? err).toLowerCase();
  if (msg.includes("unauthor") || msg.includes("forbidden") || msg.includes("invalid api key")) {
    return "fatal";
  }
  if ((msg.includes("not_found") || msg.includes("not found")) && msg.includes(vmId.toLowerCase())) {
    return "fatal";
  }
  return "recoverable";
}

function parseOptionalNumber(value: string | boolean | undefined): number | undefined | null {
  if (value === undefined) return undefined;
  if (typeof value !== "string") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
