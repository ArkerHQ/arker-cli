import { describe, it, expect } from "vitest";
import { parseArgs } from "../src/args.js";

describe("parseArgs", () => {
  it("returns null command on empty argv", () => {
    expect(parseArgs([])).toEqual({ command: null, subcommand: null, positional: [], flags: {} });
  });

  it("parses bare command with no args", () => {
    const r = parseArgs(["list"]);
    expect(r.command).toBe("list");
    expect(r.subcommand).toBeNull();
    expect(r.positional).toEqual([]);
  });

  it("parses command with positional args", () => {
    const r = parseArgs(["fork", "ubuntu"]);
    expect(r.command).toBe("fork");
    expect(r.positional).toEqual(["ubuntu"]);
  });

  it("parses string flag with value", () => {
    const r = parseArgs(["fork", "ubuntu", "--name", "hello"]);
    expect(r.command).toBe("fork");
    expect(r.positional).toEqual(["ubuntu"]);
    expect(r.flags.name).toBe("hello");
  });

  it("recognizes boolean flags without consuming next arg", () => {
    const r = parseArgs(["fork", "ubuntu", "--json", "--name", "hello"]);
    expect(r.flags.json).toBe(true);
    expect(r.flags.name).toBe("hello");
  });

  it("treats trailing flag as boolean", () => {
    const r = parseArgs(["list", "--json"]);
    expect(r.flags.json).toBe(true);
  });

  it("parses --help when first arg", () => {
    const r = parseArgs(["--help"]);
    expect(r.command).toBeNull();
    expect(r.flags.help).toBe(true);
  });

  it("parses --version when first arg", () => {
    const r = parseArgs(["--version"]);
    expect(r.command).toBeNull();
    expect(r.flags.version).toBe(true);
  });

  it("treats command --help correctly", () => {
    const r = parseArgs(["fork", "--help"]);
    expect(r.command).toBe("fork");
    expect(r.flags.help).toBe(true);
  });

  it("parses run with id and code as positional", () => {
    const r = parseArgs(["run", "01ABC", "echo hello"]);
    expect(r.command).toBe("run");
    expect(r.positional).toEqual(["01ABC", "echo hello"]);
  });

  it("parses run flags before the remote command starts", () => {
    const r = parseArgs(["run", "01ABC", "--session-id", "s1", "--timeout", "5000", "echo", "hi"]);
    expect(r.flags["session-id"]).toBe("s1");
    expect(r.flags.timeout).toBe("5000");
    expect(r.positional).toEqual(["01ABC", "echo", "hi"]);
  });

  it("keeps remote command flags after the command starts", () => {
    const r = parseArgs(["run", "01ABC", "--timeout", "5000", "pytest", "-q", "--maxfail=1"]);
    expect(r.flags.timeout).toBe("5000");
    expect(r.flags["maxfail=1"]).toBeUndefined();
    expect(r.positional).toEqual(["01ABC", "pytest", "-q", "--maxfail=1"]);
  });

  it("treats late run options as remote command args", () => {
    const r = parseArgs(["run", "01ABC", "echo", "hi", "--timeout", "5000"]);
    expect(r.flags.timeout).toBeUndefined();
    expect(r.positional).toEqual(["01ABC", "echo", "hi", "--timeout", "5000"]);
  });

  it("supports -- as an explicit run command delimiter", () => {
    const r = parseArgs(["run", "01ABC", "--timeout", "5000", "--", "pytest", "-q", "--maxfail=1"]);
    expect(r.flags.timeout).toBe("5000");
    expect(r.positional).toEqual(["01ABC", "pytest", "-q", "--maxfail=1"]);
  });

  it("parses write-file with stdin sentinel", () => {
    const r = parseArgs(["write-file", "01ABC", "/home/user/x.txt", "-"]);
    expect(r.command).toBe("write-file");
    expect(r.positional).toEqual(["01ABC", "/home/user/x.txt", "-"]);
  });

  it("parses write-file with inline data", () => {
    const r = parseArgs(["write-file", "01ABC", "/home/user/x.txt", "hello"]);
    expect(r.positional).toEqual(["01ABC", "/home/user/x.txt", "hello"]);
  });

  it("recognizes config subcommand", () => {
    for (const sub of ["set", "get", "list"]) {
      const r = parseArgs(["config", sub, "api-key", "ark_test"]);
      expect(r.command).toBe("config");
      expect(r.subcommand).toBe(sub);
    }
  });

  it("does NOT treat fork second arg as subcommand", () => {
    const r = parseArgs(["fork", "ubuntu"]);
    expect(r.subcommand).toBeNull();
    expect(r.positional).toEqual(["ubuntu"]);
  });

  it("handles -- separator: everything after is positional", () => {
    const r = parseArgs(["run", "01ABC", "--", "--this-is-not-a-flag"]);
    expect(r.command).toBe("run");
    expect(r.positional).toEqual(["01ABC", "--this-is-not-a-flag"]);
  });

  it("--api-key and --base-url consume their values", () => {
    const r = parseArgs([
      "list",
      "--api-key",
      "ark_xyz",
      "--region",
      "aws-us-west-2",
      "--base-url",
      "http://localhost:8080",
      "--burst-base-url",
      "http://localhost:8081",
    ]);
    expect(r.flags["api-key"]).toBe("ark_xyz");
    expect(r.flags.region).toBe("aws-us-west-2");
    expect(r.flags["base-url"]).toBe("http://localhost:8080");
    expect(r.flags["burst-base-url"]).toBe("http://localhost:8081");
  });

  it("parses global flags before the command", () => {
    const r = parseArgs(["--api-key", "ark_xyz", "--json", "list"]);
    expect(r.command).toBe("list");
    expect(r.flags["api-key"]).toBe("ark_xyz");
    expect(r.flags.json).toBe(true);
  });

  it("parses shell with a preload command after --", () => {
    const r = parseArgs(["shell", "vm_1", "--exit", "--", "echo", "hi"]);
    expect(r.command).toBe("shell");
    expect(r.flags.exit).toBe(true);
    expect(r.positional).toEqual(["vm_1", "echo", "hi"]);
  });

  it("treats --exit as a boolean flag (does not consume next token)", () => {
    const r = parseArgs(["shell", "vm_1", "--exit", "--timeout", "5000"]);
    expect(r.flags.exit).toBe(true);
    expect(r.flags.timeout).toBe("5000");
    expect(r.positional).toEqual(["vm_1"]);
  });

  it("recognizes sync subcommand", () => {
    const r = parseArgs(["sync", "write", "vm_1", "/remote.txt", "./local.txt"]);
    expect(r.command).toBe("sync");
    expect(r.subcommand).toBe("write");
    expect(r.positional).toEqual(["vm_1", "/remote.txt", "./local.txt"]);
  });
});
