import { Arker, type ArkerOptions } from "@arker-ai/sdk";
import { type CliConfig, loadConfig } from "./config.js";

export type ClientOverrides = Partial<Pick<CliConfig, "apiKey" | "region" | "baseUrl" | "burstBaseUrl">>;

export function resolveClientOptions(overrides: ClientOverrides = {}): ArkerOptions {
  const config = loadConfig(overrides);
  if (!config.apiKey) {
    throw new Error("No API key configured. Run 'arker config set api-key <key>' or pass --api-key.");
  }

  return {
    apiKey: config.apiKey,
    region: config.region,
    baseUrl: config.baseUrl,
    burstBaseUrl: config.burstBaseUrl,
  };
}

export function buildClient(overrides: ClientOverrides = {}): Arker {
  return new Arker(resolveClientOptions(overrides));
}
