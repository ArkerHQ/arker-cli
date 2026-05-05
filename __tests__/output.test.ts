import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { printTable, printJson, printError, printInfo, printSuccess } from "../src/output.js";

let logOutput: string[];
let errOutput: string[];
let origLog: typeof console.log;
let origErr: typeof console.error;
let origNoColor: string | undefined;

beforeEach(() => {
  logOutput = [];
  errOutput = [];
  origLog = console.log;
  origErr = console.error;
  console.log = (...args: any[]) => logOutput.push(args.join(" "));
  console.error = (...args: any[]) => errOutput.push(args.join(" "));
  origNoColor = process.env.NO_COLOR;
  // Disable colors by default in tests for predictable output
  process.env.NO_COLOR = "1";
});

afterEach(() => {
  console.log = origLog;
  console.error = origErr;
  if (origNoColor === undefined) delete process.env.NO_COLOR;
  else process.env.NO_COLOR = origNoColor;
});

describe("printTable", () => {
  it("aligns columns correctly", () => {
    printTable(
      ["ID", "NAME", "STATUS"],
      [
        ["01ABC", "test-app", "active"],
        ["01DEF", "my-long-name", "deleted"],
      ],
    );

    expect(logOutput[0]).toContain("ID");
    expect(logOutput[0]).toContain("NAME");
    // Check alignment: "my-long-name" is widest in NAME column
    const dataLine = logOutput[2]; // first data row
    const dataLine2 = logOutput[3]; // second data row
    // Both ID values should start at position 0
    expect(dataLine.startsWith("01ABC")).toBe(true);
    expect(dataLine2.startsWith("01DEF")).toBe(true);
  });

  it("prints separator line", () => {
    printTable(["A", "B"], [["x", "y"]]);
    // Line 0 = headers, Line 1 = separator, Line 2 = data
    expect(logOutput[1]).toMatch(/^-+\s+-+$/);
  });

  it("handles empty rows", () => {
    printTable(["ID", "NAME"], []);
    expect(logOutput).toEqual([]);
  });

  it("handles missing cells", () => {
    printTable(["A", "B", "C"], [["x"]]);
    expect(logOutput.length).toBe(3); // header + separator + 1 row
  });
});

describe("printJson", () => {
  it("outputs valid JSON with 2-space indent", () => {
    printJson({ a: 1, b: [2, 3] });
    const parsed = JSON.parse(logOutput.join("\n"));
    expect(parsed).toEqual({ a: 1, b: [2, 3] });
    // Check indentation
    expect(logOutput[0]).toContain("  ");
  });

  it("outputs to stdout (console.log)", () => {
    printJson({ test: true });
    expect(logOutput.length).toBeGreaterThan(0);
    expect(errOutput.length).toBe(0);
  });
});

describe("printError", () => {
  it("writes to stderr", () => {
    printError("something failed");
    expect(errOutput.length).toBe(1);
    expect(errOutput[0]).toContain("something failed");
    expect(logOutput.length).toBe(0);
  });
});

describe("printInfo", () => {
  it("writes to stderr", () => {
    printInfo("info message");
    expect(errOutput.length).toBe(1);
    expect(errOutput[0]).toContain("info message");
    expect(logOutput.length).toBe(0);
  });
});

describe("printSuccess", () => {
  it("writes to stderr", () => {
    printSuccess("done");
    expect(errOutput.length).toBe(1);
    expect(errOutput[0]).toContain("done");
    expect(logOutput.length).toBe(0);
  });
});

describe("color behavior", () => {
  it("no color when NO_COLOR is set", () => {
    process.env.NO_COLOR = "1";
    printError("test");
    expect(errOutput[0]).toBe("test");
    expect(errOutput[0]).not.toContain("\x1b[");
  });

  it("--no-color flag works via NO_COLOR env var", () => {
    // main.ts sets process.env.NO_COLOR = "1" when --no-color is passed
    // This test verifies that mechanism works
    process.env.NO_COLOR = "1";
    printError("test");
    expect(errOutput[0]).toBe("test");
    expect(errOutput[0]).not.toContain("\x1b[");
  });
});
