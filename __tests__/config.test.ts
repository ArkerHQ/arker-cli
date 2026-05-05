import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  arkerHome,
  ensureArkerDir,
  loadConfig,
  saveConfig,
  handleConfigCommand,
} from "../src/config.js";

let tempDir: string;
let origEnv: Record<string, string | undefined>;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "arker-test-"));
  origEnv = {
    ARKER_HOME: process.env.ARKER_HOME,
    ARKER_API_KEY: process.env.ARKER_API_KEY,
    ARKER_BASE_URL: process.env.ARKER_BASE_URL,
  };
  process.env.ARKER_HOME = tempDir;
  delete process.env.ARKER_API_KEY;
  delete process.env.ARKER_BASE_URL;
});

afterEach(() => {
  // Restore env
  for (const [key, val] of Object.entries(origEnv)) {
    if (val === undefined) delete process.env[key];
    else process.env[key] = val;
  }
  rmSync(tempDir, { recursive: true, force: true });
});

describe("arkerHome", () => {
  it("uses ARKER_HOME env var", () => {
    expect(arkerHome()).toBe(tempDir);
  });
});

describe("ensureArkerDir", () => {
  it("creates directory if missing", () => {
    const nested = join(tempDir, "sub", "arker");
    process.env.ARKER_HOME = nested;
    ensureArkerDir();
    expect(() => readFileSync(join(nested, "nonexistent"))).toThrow(); // dir exists, file doesn't
  });

  it("no-ops if directory exists", () => {
    ensureArkerDir(); // tempDir already exists
    ensureArkerDir(); // should not throw
  });
});

describe("saveConfig + loadConfig", () => {
  it("roundtrips save and load", () => {
    saveConfig({ apiKey: "ark_test123" });
    const config = loadConfig();
    expect(config.apiKey).toBe("ark_test123");
  });

  it("partial save does not clobber other keys", () => {
    saveConfig({ apiKey: "ark_test", baseUrl: "https://custom.example.com" });
    saveConfig({ apiKey: "ark_updated" });
    const config = loadConfig();
    expect(config.apiKey).toBe("ark_updated");
    expect(config.baseUrl).toBe("https://custom.example.com");
  });

  it("missing config file returns defaults", () => {
    const config = loadConfig();
    expect(config.apiKey).toBeUndefined();
    expect(config.baseUrl).toBe("https://aws-burst-us-west-2.arker.ai");
  });

  it("env var overrides file value", () => {
    saveConfig({ apiKey: "ark_from_file" });
    process.env.ARKER_API_KEY = "ark_from_env";
    const config = loadConfig();
    expect(config.apiKey).toBe("ark_from_env");
  });

  it("override param overrides env var", () => {
    process.env.ARKER_API_KEY = "ark_from_env";
    saveConfig({ apiKey: "ark_from_file" });
    const config = loadConfig({ apiKey: "ark_from_flag" });
    expect(config.apiKey).toBe("ark_from_flag");
  });

  it("env var ARKER_BASE_URL overrides file", () => {
    saveConfig({ baseUrl: "https://file.example.com" });
    process.env.ARKER_BASE_URL = "https://env.example.com";
    const config = loadConfig();
    expect(config.baseUrl).toBe("https://env.example.com");
  });

  it("saves valid JSON to disk", () => {
    saveConfig({ apiKey: "ark_test" });
    const raw = readFileSync(join(tempDir, "config"), "utf-8");
    expect(() => JSON.parse(raw)).not.toThrow();
    expect(JSON.parse(raw).apiKey).toBe("ark_test");
  });
});

describe("handleConfigCommand", () => {
  it("set and get roundtrip", () => {
    const logs: string[] = [];
    const origLog = console.log;
    const origErr = console.error;
    console.error = (msg: string) => logs.push(msg);

    const setCode = handleConfigCommand(["set", "api-key", "ark_test99"], {});
    expect(setCode).toBe(0);

    console.log = (msg: string) => logs.push(msg);
    const getCode = handleConfigCommand(["get", "api-key"], {});
    expect(getCode).toBe(0);
    expect(logs).toContain("ark_test99");

    console.log = origLog;
    console.error = origErr;
  });

  it("set masks api-key in output", () => {
    const errors: string[] = [];
    const origErr = console.error;
    console.error = (msg: string) => errors.push(msg);

    handleConfigCommand(["set", "api-key", "ark_supersecretkey123"], {});
    expect(errors.some((e) => e.includes("ark_...y123"))).toBe(true);
    expect(errors.some((e) => e.includes("supersecretkey"))).toBe(false);

    console.error = origErr;
  });

  it("get unknown key returns error", () => {
    const errors: string[] = [];
    const origErr = console.error;
    console.error = (msg: string) => errors.push(msg);

    const code = handleConfigCommand(["get", "bogus"], {});
    expect(code).toBe(1);
    expect(errors.some((e) => e.includes("Unknown config key"))).toBe(true);

    console.error = origErr;
  });

  it("set unknown key returns error", () => {
    const errors: string[] = [];
    const origErr = console.error;
    console.error = (msg: string) => errors.push(msg);

    const code = handleConfigCommand(["set", "bogus", "val"], {});
    expect(code).toBe(1);

    console.error = origErr;
  });

  it("get unset key returns error", () => {
    const errors: string[] = [];
    const origErr = console.error;
    console.error = (msg: string) => errors.push(msg);

    const code = handleConfigCommand(["get", "api-key"], {});
    expect(code).toBe(1);
    expect(errors.some((e) => e.includes("not set"))).toBe(true);

    console.error = origErr;
  });

  it("--help flag shows help", () => {
    const logs: string[] = [];
    const origLog = console.log;
    console.log = (msg: string) => logs.push(msg);

    const code = handleConfigCommand([], { help: true });
    expect(code).toBe(0);
    expect(logs.some((l) => l.includes("arker config"))).toBe(true);

    console.log = origLog;
  });

  it("no args shows help", () => {
    const logs: string[] = [];
    const origLog = console.log;
    console.log = (msg: string) => logs.push(msg);

    const code = handleConfigCommand([], {});
    expect(code).toBe(0);

    console.log = origLog;
  });

  it("unknown action returns error", () => {
    const errors: string[] = [];
    const origErr = console.error;
    console.error = (msg: string) => errors.push(msg);

    const code = handleConfigCommand(["reset"], {});
    expect(code).toBe(1);
    expect(errors.some((e) => e.includes("Unknown config action"))).toBe(true);

    console.error = origErr;
  });

  it("set base-url works", () => {
    const code = handleConfigCommand(
      ["set", "base-url", "https://custom.example.com"],
      {},
    );
    expect(code).toBe(0);
    const config = loadConfig();
    expect(config.baseUrl).toBe("https://custom.example.com");
  });
});
