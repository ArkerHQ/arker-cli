import { describe, it, expect } from "vitest";
import { buildPrompt, classifyError, displayPath, shellCommand, shortVmId } from "../src/commands/shell.js";

describe("shortVmId", () => {
  it("returns id unchanged when short", () => {
    expect(shortVmId("abc")).toBe("abc");
    expect(shortVmId("abcdef")).toBe("abcdef");
  });

  it("returns the last 6 chars for long ids", () => {
    expect(shortVmId("vm_0123456789")).toBe("456789");
  });
});

describe("displayPath", () => {
  it("collapses exact home to ~", () => {
    expect(displayPath("/home/user", "/home/user")).toBe("~");
  });

  it("collapses subpath of home to ~/rest", () => {
    expect(displayPath("/home/user/projects/foo", "/home/user")).toBe("~/projects/foo");
  });

  it("leaves non-home paths absolute", () => {
    expect(displayPath("/etc/hosts", "/home/user")).toBe("/etc/hosts");
  });

  it("does not collapse partial prefix matches", () => {
    // /home/userland must not become ~land
    expect(displayPath("/home/userland/x", "/home/user")).toBe("/home/userland/x");
  });

  it("falls back to raw cwd when home is empty", () => {
    expect(displayPath("/tmp", "")).toBe("/tmp");
  });
});

describe("buildPrompt", () => {
  it("formats arker@<short>:<cwd>$ ", () => {
    expect(
      buildPrompt({ vmId: "vm_0123456789", cwd: "/home/user/foo", remoteHome: "/home/user" }),
    ).toBe("arker@456789:~/foo$ ");
  });
});

describe("classifyError", () => {
  it("treats auth errors as fatal", () => {
    expect(classifyError(new Error("Unauthorized: bad key"), "vm_1")).toBe("fatal");
    expect(classifyError(new Error("invalid API key"), "vm_1")).toBe("fatal");
  });

  it("treats VM-targeted not_found as fatal", () => {
    expect(classifyError(new Error("not_found: vm vm_abc does not exist"), "vm_abc")).toBe("fatal");
  });

  it("treats other not_found as recoverable", () => {
    // e.g. a file not found inside the command — shell should keep going
    expect(classifyError(new Error("not_found: file /tmp/missing"), "vm_1")).toBe("recoverable");
  });

  it("defaults to recoverable", () => {
    expect(classifyError(new Error("connection reset"), "vm_1")).toBe("recoverable");
  });
});

describe("shellCommand argument validation", () => {
  it("rejects missing vm id", async () => {
    expect(await shellCommand({} as any, [], {})).toBe(1);
  });

  it("rejects invalid --timeout", async () => {
    expect(await shellCommand({} as any, ["vm_1"], { timeout: "not-a-number" })).toBe(1);
  });
});
