import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

export interface CliConfig {
  apiKey?: string;
  region?: string;
  baseUrl?: string;
  burstBaseUrl?: string;
}

export const DEFAULT_REGION = "aws-us-west-2";

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
export function loadConfig(overrides?: Partial<CliConfig>): CliConfig {
  let fileConfig: CliConfig = {};

  const path = configPath();
  if (existsSync(path)) {
    try {
      fileConfig = JSON.parse(readFileSync(path, "utf-8"));
    } catch {
      // Corrupted config file — ignore, use defaults
    }
  }

  const apiKey = nonEmpty(overrides?.apiKey) ?? nonEmpty(process.env.ARKER_API_KEY) ?? nonEmpty(fileConfig.apiKey);
  const baseUrl = nonEmpty(overrides?.baseUrl) ?? nonEmpty(process.env.ARKER_BASE_URL) ?? nonEmpty(fileConfig.baseUrl);
  const burstBaseUrl = nonEmpty(overrides?.burstBaseUrl)
    ?? nonEmpty(process.env.ARKER_BURST_BASE_URL)
    ?? nonEmpty(fileConfig.burstBaseUrl);
  const region = nonEmpty(overrides?.region)
    ?? nonEmpty(process.env.ARKER_REGION)
    ?? nonEmpty(fileConfig.region)
    ?? (baseUrl ? undefined : DEFAULT_REGION);

  return {
    apiKey,
    region,
    baseUrl,
    burstBaseUrl,
  };
}

/**
 * Save partial config, merging with existing values.
 * Only provided keys are updated — other keys preserved.
 */
export function saveConfig(partial: Partial<CliConfig>): void {
  ensureArkerDir();

  let existing: CliConfig = {};
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

/** Map of CLI config key names to stored config property names. */
const CONFIG_KEYS: Record<string, keyof CliConfig> = {
  "api-key": "apiKey",
  region: "region",
  "base-url": "baseUrl",
  "burst-base-url": "burstBaseUrl",
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

  if (action === "list") {
    const config = loadConfig();
    const output = {
      apiKey: config.apiKey ? maskApiKey(config.apiKey) : null,
      region: config.region,
      baseUrl: config.baseUrl ?? null,
      burstBaseUrl: config.burstBaseUrl ?? null,
    };

    if (flags.json === true) {
      console.log(JSON.stringify(output, null, 2));
      return 0;
    }

    console.log(`api-key: ${output.apiKey ?? "(not set)"}`);
    console.log(`region: ${output.region ?? "(not set)"}`);
    console.log(`base-url: ${output.baseUrl ?? "(not set)"}`);
    console.log(`burst-base-url: ${output.burstBaseUrl ?? "(not set)"}`);
    return 0;
  }

  console.error(`Unknown config action: ${action}`);
  console.error("Usage: arker config <set|get|list> <key> [value]");
  return 1;
}

export function maskApiKey(key: string): string {
  if (key.length <= 8) return "***";
  return key.slice(0, 4) + "..." + key.slice(-4);
}

function nonEmpty(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

const CONFIG_HELP = `arker config — Manage CLI configuration

Usage:
  arker config set <key> <value>    Set a config value
  arker config get <key>            Get a config value
  arker config list                 List resolved config

Keys:
  api-key      API key for authentication (ark_*)
  region       Arker region (default: ${DEFAULT_REGION})
  base-url     Internal/dev base URL override
  burst-base-url Internal/dev burst base URL override

Config is stored in ~/.arker/config.
Environment variables ARKER_API_KEY, ARKER_REGION, ARKER_BASE_URL, and ARKER_BURST_BASE_URL override file values.`;
