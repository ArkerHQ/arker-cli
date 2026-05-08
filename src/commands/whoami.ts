import { loadConfig, maskApiKey } from "../config.js";
import { printInfo, printJson } from "../output.js";

/**
 * arker whoami — print resolved local routing config.
 */
export async function whoamiCommand(
  flags: Record<string, string | boolean>,
  overrides?: { apiKey?: string; region?: string; baseUrl?: string; burstBaseUrl?: string },
): Promise<number> {
  const config = loadConfig(overrides);
  const result = {
    apiKey: config.apiKey ? maskApiKey(config.apiKey) : null,
    region: config.region,
    baseUrl: config.baseUrl ?? null,
    burstBaseUrl: config.burstBaseUrl ?? null,
  };

  if (flags.json === true) {
    printJson(result);
    return 0;
  }

  printInfo(`API key:  ${config.apiKey ? maskApiKey(config.apiKey) : "(not set)"}`);
  printInfo(`Region:   ${config.region ?? "(not set)"}`);
  printInfo(`Base URL override: ${config.baseUrl ?? "(not set)"}`);
  printInfo(`Burst base URL override: ${config.burstBaseUrl ?? "(not set)"}`);
  return 0;
}
