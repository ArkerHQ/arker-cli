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
    const r = parseArgs(["fork", "arkuntu"]);
    expect(r.command).toBe("fork");
    expect(r.positional).toEqual(["arkuntu"]);
  });

  it("parses string flag with value", () => {
    const r = parseArgs(["fork", "arkuntu", "--name", "hello"]);
    expect(r.command).toBe("fork");
    expect(r.positional).toEqual(["arkuntu"]);
    expect(r.flags.name).toBe("hello");
  });

  it("recognizes boolean flags without consuming next arg", () => {
    const r = parseArgs(["fork", "arkuntu", "--public", "--name", "hello"]);
    expect(r.flags.public).toBe(true);
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

  it("parses run with --session-id and --timeout flags", () => {
    const r = parseArgs(["run", "01ABC", "echo hi", "--session-id", "s1", "--timeout", "5000"]);
    expect(r.flags["session-id"]).toBe("s1");
    expect(r.flags.timeout).toBe("5000");
    expect(r.positional).toEqual(["01ABC", "echo hi"]);
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
    for (const sub of ["set", "get", "unset"]) {
      const r = parseArgs(["config", sub, "api-key", "ark_test"]);
      expect(r.command).toBe("config");
      expect(r.subcommand).toBe(sub);
    }
  });

  it("does NOT treat fork second arg as subcommand", () => {
    const r = parseArgs(["fork", "arkuntu"]);
    expect(r.subcommand).toBeNull();
    expect(r.positional).toEqual(["arkuntu"]);
  });

  it("handles -- separator: everything after is positional", () => {
    const r = parseArgs(["run", "01ABC", "--", "--this-is-not-a-flag"]);
    expect(r.command).toBe("run");
    expect(r.positional).toEqual(["01ABC", "--this-is-not-a-flag"]);
  });

  it("--api-key and --base-url consume their values", () => {
    const r = parseArgs(["list", "--api-key", "ark_xyz", "--base-url", "http://localhost:8080"]);
    expect(r.flags["api-key"]).toBe("ark_xyz");
    expect(r.flags["base-url"]).toBe("http://localhost:8080");
  });
});
