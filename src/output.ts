const RESET = "\x1b[0m";
const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const DIM = "\x1b[2m";

function colorsEnabled(): boolean {
  if (process.env.NO_COLOR !== undefined) return false;
  if (!process.stderr.isTTY) return false;
  return true;
}

function colorize(color: string, text: string): string {
  if (!colorsEnabled()) return text;
  return `${color}${text}${RESET}`;
}

/** Print aligned table to stdout. */
export function printTable(headers: string[], rows: string[][]): void {
  if (rows.length === 0) return;

  const colWidths = headers.map((h, i) => {
    let max = h.length;
    for (const row of rows) {
      const cell = row[i] ?? "";
      if (cell.length > max) max = cell.length;
    }
    return max;
  });

  const pad = (s: string, width: number) => s + " ".repeat(Math.max(0, width - s.length));

  const headerLine = headers.map((h, i) => pad(h, colWidths[i])).join("  ");
  const separator = colWidths.map((w) => "-".repeat(w)).join("  ");

  console.log(headerLine);
  console.log(separator);
  for (const row of rows) {
    console.log(row.map((cell, i) => pad(cell ?? "", colWidths[i])).join("  "));
  }
}

/** Print JSON to stdout with 2-space indent. */
export function printJson(data: unknown): void {
  console.log(JSON.stringify(data, null, 2));
}

/**
 * Extract a single property from a result and print it as plain text.
 * For arrays, prints one value per line. For Uint8Array-valued fields
 * (e.g. RunResult.stdout), writes raw bytes.
 *
 * Returns true if the field was found (even if value was null/undefined),
 * false if the result has no such property at all.
 */
export function printField(data: unknown, field: string): boolean {
  if (Array.isArray(data)) {
    for (const item of data) printField(item, field);
    return true;
  }
  if (data === null || typeof data !== "object") return false;
  if (!(field in (data as Record<string, unknown>))) return false;
  const v = (data as Record<string, unknown>)[field];
  if (v === undefined || v === null) {
    console.log("");
    return true;
  }
  if (v instanceof Uint8Array) {
    process.stdout.write(v);
    return true;
  }
  if (typeof v === "object") {
    console.log(JSON.stringify(v));
    return true;
  }
  console.log(String(v));
  return true;
}

/** Print error message to stderr (red). */
export function printError(msg: string): void {
  console.error(colorize(RED, msg));
}

/** Print info message to stderr (dim). */
export function printInfo(msg: string): void {
  console.error(colorize(DIM, msg));
}

/** Print success message to stderr (green). */
export function printSuccess(msg: string): void {
  console.error(colorize(GREEN, msg));
}
