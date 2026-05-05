import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { listCommand } from "../src/commands/list.js";
import { forkCommand } from "../src/commands/fork.js";
import { deleteCommand } from "../src/commands/delete.js";
import { runCommand } from "../src/commands/run.js";
import { readFileCommand, writeFileCommand } from "../src/commands/files.js";

/** Build a mock Arker that records the calls made through it. */
function mockArker(impl: {
  list?: (opts: any) => Promise<any>;
  fork?: (opts: any) => Promise<{ id: string }>;
  delete?: () => Promise<void>;
  run?: (cmd: string, opts: any) => Promise<any>;
  readFile?: (path: string) => Promise<Uint8Array>;
  writeFile?: (path: string, data: any) => Promise<void>;
}) {
  return {
    list: vi.fn(impl.list ?? (async () => ({ items: [], total: 0 }))),
    vm: vi.fn((id: string) => ({
      id,
      fork: vi.fn(impl.fork ?? (async () => ({ id: "child" }))),
      delete: vi.fn(impl.delete ?? (async () => {})),
      run: vi.fn(impl.run ?? (async () => ({
        stdout: new Uint8Array(),
        stderr: new Uint8Array(),
        exitCode: 0,
        durationMs: 1,
        sessionId: "s",
        cwd: "/",
      }))),
      sync: {
        readFile: vi.fn(impl.readFile ?? (async () => new Uint8Array())),
        writeFile: vi.fn(impl.writeFile ?? (async () => {})),
      },
    })),
  } as any;
}

describe("listCommand", () => {
  it("calls arker.list with parsed flags", async () => {
    const arker = mockArker({
      list: async (opts) => ({ items: [], total: 0, _opts: opts }),
    });
    const code = await listCommand(arker, { limit: "5", q: "foo", sort: "-created_at", json: true });
    expect(code).toBe(0);
    expect(arker.list).toHaveBeenCalledWith({ limit: 5, q: "foo", sort: "-created_at", offset: undefined });
  });

  it("returns 1 on SDK error", async () => {
    const arker = mockArker({ list: async () => { throw new Error("boom"); } });
    const code = await listCommand(arker, {});
    expect(code).toBe(1);
  });
});

describe("forkCommand", () => {
  it("calls vm(id).fork with parsed flags", async () => {
    let capturedFork: any;
    const arker = mockArker({
      fork: async (opts) => { capturedFork = opts; return { id: "child123" }; },
    });
    const code = await forkCommand(arker, ["arkuntu"], { name: "hello", region: "us-west-2", public: true });
    expect(code).toBe(0);
    expect(arker.vm).toHaveBeenCalledWith("arkuntu");
    expect(capturedFork).toEqual({ name: "hello", region: "us-west-2", isPublic: true });
  });

  it("rejects missing id", async () => {
    const code = await forkCommand(mockArker({}), [], {});
    expect(code).toBe(1);
  });
});

describe("deleteCommand", () => {
  it("calls vm(id).delete", async () => {
    let deleted = false;
    const arker = mockArker({ delete: async () => { deleted = true; } });
    const code = await deleteCommand(arker, ["01ABC"], {});
    expect(code).toBe(0);
    expect(deleted).toBe(true);
  });

  it("rejects missing id", async () => {
    const code = await deleteCommand(mockArker({}), [], {});
    expect(code).toBe(1);
  });
});

describe("runCommand", () => {
  it("calls vm(id).run with id and code, returns exitCode", async () => {
    let captured: { cmd: string; opts: any } | null = null;
    const arker = mockArker({
      run: async (cmd, opts) => {
        captured = { cmd, opts };
        return {
          stdout: new TextEncoder().encode("hello"),
          stderr: new Uint8Array(),
          exitCode: 42,
          durationMs: 1,
          sessionId: "s",
          cwd: "/",
        };
      },
    });
    // Suppress stdout in the test
    const writeSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const code = await runCommand(arker, ["01ABC", "echo", "hello"], {});
    writeSpy.mockRestore();
    expect(code).toBe(42);
    expect(captured!.cmd).toBe("echo hello");
    expect(captured!.opts).toEqual({ sessionId: undefined, timeout: undefined });
  });

  it("rejects missing id or code", async () => {
    expect(await runCommand(mockArker({}), [], {})).toBe(1);
    expect(await runCommand(mockArker({}), ["01ABC"], {})).toBe(1);
  });

  it("passes session-id and timeout flags", async () => {
    let captured: any = null;
    const arker = mockArker({
      run: async (_cmd, opts) => {
        captured = opts;
        return { stdout: new Uint8Array(), stderr: new Uint8Array(), exitCode: 0, durationMs: 1, sessionId: "s", cwd: "/" };
      },
    });
    const writeSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    await runCommand(arker, ["01ABC", "ls"], { "session-id": "s1", timeout: "5000" });
    writeSpy.mockRestore();
    expect(captured).toEqual({ sessionId: "s1", timeout: 5000 });
  });
});

describe("readFileCommand", () => {
  it("calls sync.readFile and writes bytes to stdout", async () => {
    let captured = "";
    const arker = mockArker({
      readFile: async (path) => { captured = path; return new TextEncoder().encode("filebytes"); },
    });
    const writeSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const code = await readFileCommand(arker, ["01ABC", "/home/user/x.txt"]);
    writeSpy.mockRestore();
    expect(code).toBe(0);
    expect(captured).toBe("/home/user/x.txt");
  });

  it("rejects missing args", async () => {
    expect(await readFileCommand(mockArker({}), [])).toBe(1);
    expect(await readFileCommand(mockArker({}), ["01ABC"])).toBe(1);
  });
});

describe("writeFileCommand", () => {
  it("calls sync.writeFile with inline data", async () => {
    let capturedPath = "";
    let capturedData: any = null;
    const arker = mockArker({
      writeFile: async (path, data) => { capturedPath = path; capturedData = data; },
    });
    const code = await writeFileCommand(arker, ["01ABC", "/home/user/x.txt", "hello"]);
    expect(code).toBe(0);
    expect(capturedPath).toBe("/home/user/x.txt");
    expect(capturedData).toBe("hello");
  });

  it("rejects missing args", async () => {
    expect(await writeFileCommand(mockArker({}), [])).toBe(1);
    expect(await writeFileCommand(mockArker({}), ["01ABC"])).toBe(1);
  });
});
