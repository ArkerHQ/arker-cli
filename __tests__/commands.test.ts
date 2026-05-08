import { describe, it, expect, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { listCommand } from "../src/commands/list.js";
import { forkCommand } from "../src/commands/fork.js";
import { deleteCommand } from "../src/commands/delete.js";
import { runCommand } from "../src/commands/run.js";
import { readFileCommand, syncCommand, writeFileCommand } from "../src/commands/files.js";

function mockArker(impl: {
  list?: () => Promise<any>;
  fork?: (opts: any) => Promise<{ id: string }>;
  delete?: () => Promise<any>;
  run?: (cmd: string, opts: any) => Promise<any>;
  readFile?: (path: string) => Promise<Uint8Array>;
  writeFile?: (path: string, data: any) => Promise<void>;
}) {
  return {
    list: vi.fn(impl.list ?? (async () => ({ vms: [] }))),
    vm: vi.fn((id: string) => ({
      id,
      fork: vi.fn(impl.fork ?? (async () => ({ id: "child" }))),
      delete: vi.fn(impl.delete ?? (async () => ({ deleted: true }))),
      run: vi.fn(impl.run ?? (async () => completedRun())),
      sync: {
        readFile: vi.fn(impl.readFile ?? (async () => new Uint8Array())),
        writeFile: vi.fn(impl.writeFile ?? (async () => {})),
      },
    })),
  } as any;
}

function completedRun(overrides: Partial<ReturnType<typeof baseCompletedRun>> = {}) {
  return { ...baseCompletedRun(), ...overrides };
}

function baseCompletedRun() {
  return {
    type: "completed" as const,
    completed: true,
    stdout: new Uint8Array(),
    stdoutEncoding: "utf-8",
    stderr: new Uint8Array(),
    stderrEncoding: "utf-8",
    exitCode: 0,
  };
}

describe("listCommand", () => {
  it("calls arker.list without request adapters", async () => {
    const arker = mockArker({ list: async () => ({ vms: [] }) });

    const code = await listCommand(arker, { json: true });

    expect(code).toBe(0);
    expect(arker.list).toHaveBeenCalledWith();
  });

  it("prints the current vms response shape", async () => {
    const arker = mockArker({
      list: async () => ({
        vms: [
          { vm_id: "vm_1", name: "first", state: "running", source_golden: "ubuntu", created_at: "now", sessions: [] },
        ],
      }),
    });
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      const code = await listCommand(arker, {});
      expect(code).toBe(0);
      expect(logSpy.mock.calls.flat().join("\n")).toContain("vm_1");
    } finally {
      logSpy.mockRestore();
    }
  });

  it("returns 1 on SDK error", async () => {
    const arker = mockArker({ list: async () => { throw new Error("boom"); } });
    expect(await listCommand(arker, {})).toBe(1);
  });
});

describe("forkCommand", () => {
  it("calls vm(source).fork with only name", async () => {
    let capturedFork: any;
    const arker = mockArker({
      fork: async (opts) => {
        capturedFork = opts;
        return { id: "child123" };
      },
    });

    const code = await forkCommand(arker, ["ubuntu"], { name: "hello", region: "aws-us-west-2" });

    expect(code).toBe(0);
    expect(arker.vm).toHaveBeenCalledWith("ubuntu");
    expect(capturedFork).toEqual({ name: "hello" });
  });

  it("rejects missing source", async () => {
    expect(await forkCommand(mockArker({}), [], {})).toBe(1);
  });
});

describe("deleteCommand", () => {
  it("calls vm(id).delete without inspecting stale fields", async () => {
    let deleted = false;
    const arker = mockArker({ delete: async () => { deleted = true; return {}; } });

    const code = await deleteCommand(arker, ["vm_1"], {});

    expect(code).toBe(0);
    expect(deleted).toBe(true);
  });

  it("prints raw delete response as json", async () => {
    const arker = mockArker({ delete: async () => ({ deleted: true }) });
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      const code = await deleteCommand(arker, ["vm_1"], { json: true });
      expect(code).toBe(0);
      expect(JSON.parse(logSpy.mock.calls[0]![0])).toEqual({ deleted: true });
    } finally {
      logSpy.mockRestore();
    }
  });
});

describe("runCommand", () => {
  it("maps --session-id to session_id and returns completed exit code", async () => {
    let captured: { cmd: string; opts: any } | null = null;
    const stdout = new TextEncoder().encode("hello");
    const arker = mockArker({
      run: async (cmd, opts) => {
        captured = { cmd, opts };
        return completedRun({ stdout, exitCode: 42 });
      },
    });
    const writeSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    try {
      const code = await runCommand(arker, ["vm_1", "echo", "hello"], { "session-id": "s1", timeout: "5000" });
      expect(code).toBe(42);
      expect(captured).toEqual({ cmd: "echo hello", opts: { session_id: "s1", timeout: 5000 } });
      expect(writeSpy).toHaveBeenCalledWith(stdout);
    } finally {
      writeSpy.mockRestore();
    }
  });

  it("prints background run ids", async () => {
    const arker = mockArker({
      run: async () => ({ type: "background", completed: false, runId: "run_1", tunnels: [], network: null }),
    });
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      const code = await runCommand(arker, ["vm_1", "sleep 60"], {});
      expect(code).toBe(0);
      expect(logSpy).toHaveBeenCalledWith("run_1");
    } finally {
      logSpy.mockRestore();
    }
  });

  it("prints pty session info", async () => {
    const arker = mockArker({
      run: async () => ({ type: "pty", pty: true, sessionId: "s1", wsUrl: "wss://example.test" }),
    });
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      const code = await runCommand(arker, ["vm_1", "bash"], {});
      expect(code).toBe(0);
      expect(logSpy).toHaveBeenCalledWith("session_id: s1");
      expect(logSpy).toHaveBeenCalledWith("ws_url: wss://example.test");
    } finally {
      logSpy.mockRestore();
    }
  });

  it("rejects missing id or command", async () => {
    expect(await runCommand(mockArker({}), [], {})).toBe(1);
    expect(await runCommand(mockArker({}), ["vm_1"], {})).toBe(1);
  });
});

describe("file commands", () => {
  it("calls sync.readFile and writes bytes to stdout", async () => {
    let captured = "";
    const bytes = new TextEncoder().encode("filebytes");
    const arker = mockArker({
      readFile: async (path) => {
        captured = path;
        return bytes;
      },
    });
    const writeSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    try {
      const code = await readFileCommand(arker, ["vm_1", "/home/user/x.txt"]);
      expect(code).toBe(0);
      expect(captured).toBe("/home/user/x.txt");
      expect(writeSpy).toHaveBeenCalledWith(bytes);
    } finally {
      writeSpy.mockRestore();
    }
  });

  it("legacy write-file calls sync.writeFile with inline data", async () => {
    let capturedPath = "";
    let capturedData: any = null;
    const arker = mockArker({
      writeFile: async (path, data) => {
        capturedPath = path;
        capturedData = data;
      },
    });

    const code = await writeFileCommand(arker, ["vm_1", "/home/user/x.txt", "hello"]);

    expect(code).toBe(0);
    expect(capturedPath).toBe("/home/user/x.txt");
    expect(capturedData).toBe("hello");
  });

  it("sync read maps directly to sync.readFile", async () => {
    const arker = mockArker({ readFile: async () => new TextEncoder().encode("ok") });
    const writeSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    try {
      const code = await syncCommand(arker, "read", ["vm_1", "/home/user/x.txt"], {});
      expect(code).toBe(0);
      expect(writeSpy).toHaveBeenCalledWith(new TextEncoder().encode("ok"));
    } finally {
      writeSpy.mockRestore();
    }
  });

  it("sync write reads a local file and calls sync.writeFile", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "arker-cli-files-"));
    const localPath = join(tempDir, "input.txt");
    let capturedPath = "";
    let capturedData: any = null;
    const arker = mockArker({
      writeFile: async (path, data) => {
        capturedPath = path;
        capturedData = data;
      },
    });

    try {
      writeFileSync(localPath, "hello");
      const code = await syncCommand(arker, "write", ["vm_1", "/home/user/input.txt", localPath], {});
      expect(code).toBe(0);
      expect(capturedPath).toBe("/home/user/input.txt");
      expect(new TextDecoder().decode(capturedData)).toBe("hello");
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
