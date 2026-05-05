import { loadConfig, maskApiKey } from "../config.js";
import { printInfo, printJson } from "../output.js";

/**
 * arker whoami — print resolved API key (masked) and base URL.
 */
export async function whoamiCommand(
  flags: Record<string, string | boolean>,
  overrides?: { apiKey?: string; baseUrl?: string },
): Promise<number> {
  const config = loadConfig(overrides);

  if (flags.json === true) {
    printJson({
      apiKey: config.apiKey ? maskApiKey(config.apiKey) : null,
      baseUrl: config.baseUrl,
    });
    return 0;
  }

  printInfo(`API key:  ${config.apiKey ? maskApiKey(config.apiKey) : "(not set)"}`);
  printInfo(`Base URL: ${config.baseUrl}`);
  return 0;
}
