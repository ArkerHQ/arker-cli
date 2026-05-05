import { loadConfig, maskApiKey } from "../config.js";
import { printInfo, printJson, printField } from "../output.js";

/**
 * arker whoami — print resolved API key (masked) and base URL.
 */
export async function whoamiCommand(
  flags: Record<string, string | boolean>,
  overrides?: { apiKey?: string; baseUrl?: string },
): Promise<number> {
  const config = loadConfig(overrides);
  const result = {
    apiKey: config.apiKey ? maskApiKey(config.apiKey) : null,
    baseUrl: config.baseUrl,
  };

  if (flags.json === true) {
    printJson(result);
    return 0;
  }

  const field = typeof flags.field === "string" ? flags.field : undefined;
  if (field) {
    printField(result, field);
    return 0;
  }

  printInfo(`API key:  ${config.apiKey ? maskApiKey(config.apiKey) : "(not set)"}`);
  printInfo(`Base URL: ${config.baseUrl}`);
  return 0;
}
