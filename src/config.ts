import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

export interface ArkerConfig {
  apiKey?: string;
  baseUrl?: string;
}

const DEFAULT_BASE_URL = "https://aws-burst-us-west-2.arker.ai";

/**
 * Returns the arker home directory path.
 * Uses ARKER_HOME env var if set (for testing), otherwise ~/.arker.
 */
export function arkerHome(): string {
  return process.env.ARKER_HOME ?? join(homedir(), ".arker");
}

/** Creates ~/.arker/ directory if it doesn't exist. */
export function ensureArkerDir(): void {
  const dir = arkerHome();
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function configPath(): string {
  return join(arkerHome(), "config");
}

/**
 * Load config from disk, merge with env vars, merge with overrides.
 * Priority: overrides > env vars > config file > defaults.
 */
export function loadConfig(overrides?: Partial<ArkerConfig>): ArkerConfig {
  let fileConfig: ArkerConfig = {};

  const path = configPath();
  if (existsSync(path)) {
    try {
      fileConfig = JSON.parse(readFileSync(path, "utf-8"));
    } catch {
      // Corrupted config file — ignore, use defaults
    }
  }

  const envApiKey = process.env.ARKER_API_KEY;
  const envBaseUrl = process.env.ARKER_BASE_URL;

  return {
    apiKey: overrides?.apiKey ?? envApiKey ?? fileConfig.apiKey,
    baseUrl: overrides?.baseUrl ?? envBaseUrl ?? fileConfig.baseUrl ?? DEFAULT_BASE_URL,
  };
}

/**
 * Save partial config, merging with existing values.
 * Only provided keys are updated — other keys preserved.
 */
export function saveConfig(partial: Partial<ArkerConfig>): void {
  ensureArkerDir();

  let existing: ArkerConfig = {};
  const path = configPath();
  if (existsSync(path)) {
    try {
      existing = JSON.parse(readFileSync(path, "utf-8"));
    } catch {
      // Corrupted — start fresh
    }
  }

  const merged = { ...existing, ...partial };
  writeFileSync(path, JSON.stringify(merged, null, 2) + "\n");
}

/** Map of CLI config key names to ArkerConfig property names. */
const CONFIG_KEYS: Record<string, keyof ArkerConfig> = {
  "api-key": "apiKey",
  "base-url": "baseUrl",
};

/**
 * Handle `arker config set <key> <value>` and `arker config get <key>`.
 * Returns exit code.
 */
export function handleConfigCommand(
  positional: string[],
  flags: Record<string, string | boolean>,
): number {
  if (flags.help === true || positional.length === 0) {
    console.log(CONFIG_HELP);
    return 0;
  }

  const action = positional[0];

  if (action === "set") {
    const key = positional[1];
    const value = positional[2];
    if (!key || !value) {
      console.error("Usage: arker config set <key> <value>");
      return 1;
    }
    const prop = CONFIG_KEYS[key];
    if (!prop) {
      console.error(`Unknown config key: ${key}`);
      console.error(`Valid keys: ${Object.keys(CONFIG_KEYS).join(", ")}`);
      return 1;
    }
    saveConfig({ [prop]: value });
    console.error(`Set ${key} = ${key === "api-key" ? maskApiKey(value) : value}`);
    return 0;
  }

  if (action === "get") {
    const key = positional[1];
    if (!key) {
      console.error("Usage: arker config get <key>");
      return 1;
    }
    const prop = CONFIG_KEYS[key];
    if (!prop) {
      console.error(`Unknown config key: ${key}`);
      console.error(`Valid keys: ${Object.keys(CONFIG_KEYS).join(", ")}`);
      return 1;
    }
    const config = loadConfig();
    const val = config[prop];
    if (val === undefined) {
      console.error(`${key} is not set`);
      return 1;
    }
    console.log(val);
    return 0;
  }

  console.error(`Unknown config action: ${action}`);
  console.error("Usage: arker config <set|get> <key> [value]");
  return 1;
}

export function maskApiKey(key: string): string {
  if (key.length <= 8) return "***";
  return key.slice(0, 4) + "..." + key.slice(-4);
}

const CONFIG_HELP = `arker config — Manage CLI configuration

Usage:
  arker config set <key> <value>    Set a config value
  arker config get <key>            Get a config value

Keys:
  api-key      API key for authentication (ark_*)
  base-url     Base URL for the Arker API

Config is stored in ~/.arker/config.
Environment variables ARKER_API_KEY and ARKER_BASE_URL override file values.`;
