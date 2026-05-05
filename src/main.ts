import { Arker } from "@arker-ai/sdk";
import { parseArgs, getFlagString } from "./args.js";
import { handleConfigCommand, loadConfig } from "./config.js";
import { listCommand } from "./commands/list.js";
import { forkCommand } from "./commands/fork.js";
import { deleteCommand } from "./commands/delete.js";
import { readFileCommand, writeFileCommand } from "./commands/files.js";
import { runCommand } from "./commands/run.js";
import { whoamiCommand } from "./commands/whoami.js";

const VERSION = "0.2.3";

const HELP = `arker v${VERSION} — CLI for the Arker virtual computer platform

Usage:
  arker <command> [args] [options]

Commands:
  list                            List your VMs
  fork <id|template>              Fork a VM (or create one from a template)
  run <id> <command>              Execute a command on a VM
  read-file <id> <path>           Read a file from a VM (bytes → stdout)
  write-file <id> <path> [data]   Write data to a VM file ("-" or omitted → stdin)
  delete <id>                     Delete a VM
  config {set,get} <key> [val]    Manage CLI config
  whoami                          Show resolved config

Global flags:
  --help          Show help
  --version       Show version
  --json          Output raw JSON
  --no-color      Disable colored output
  --api-key KEY   Override API key for this invocation
  --base-url URL  Override base URL for this invocation

Examples:
  arker fork arkuntu --name hello
  arker run 01ABC... 'echo hi'
  arker write-file 01ABC... /home/user/x.txt 'hi'
  echo 'hi' | arker write-file 01ABC... /home/user/x.txt -
  arker read-file 01ABC... /home/user/x.txt > out.txt
  arker delete 01ABC...
`;

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.flags["no-color"] === true) process.env.NO_COLOR = "1";
  if (args.flags.version === true) {
    console.log(VERSION);
    process.exit(0);
  }
  if (args.command === null || args.flags.help === true) {
    console.log(HELP);
    process.exit(0);
  }

  const overrides = {
    apiKey: getFlagString(args.flags, "api-key") ?? undefined,
    baseUrl: getFlagString(args.flags, "base-url") ?? undefined,
  };

  switch (args.command) {
    case "config":
      process.exit(handleConfigCommand(args.positional, args.flags));
    case "whoami":
      process.exit(await whoamiCommand(args.flags, overrides));
    case "list":
      process.exit(await listCommand(buildClient(overrides), args.flags));
    case "fork":
      process.exit(await forkCommand(buildClient(overrides), args.positional, args.flags));
    case "delete":
      process.exit(await deleteCommand(buildClient(overrides), args.positional, args.flags));
    case "run":
      process.exit(await runCommand(buildClient(overrides), args.positional, args.flags));
    case "read-file":
      process.exit(await readFileCommand(buildClient(overrides), args.positional));
    case "write-file":
      process.exit(await writeFileCommand(buildClient(overrides), args.positional));
    default:
      console.error(`Unknown command: ${args.command}`);
      console.error("Run 'arker --help' for usage.");
      process.exit(1);
  }
}

function buildClient(overrides: { apiKey?: string; baseUrl?: string }): Arker {
  const config = loadConfig(overrides);
  if (!config.apiKey) {
    console.error("No API key configured. Run 'arker config set api-key <key>' or pass --api-key.");
    process.exit(1);
  }
  return new Arker({ apiKey: config.apiKey, baseUrl: config.baseUrl });
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
