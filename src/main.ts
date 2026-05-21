import { parseArgs, getFlagString } from "./args.js";
import { buildClient, type ClientOverrides } from "./client.js";
import { handleConfigCommand } from "./config.js";
import { listCommand } from "./commands/list.js";
import { forkCommand } from "./commands/fork.js";
import { deleteCommand } from "./commands/delete.js";
import { readFileCommand, syncCommand, writeFileCommand } from "./commands/files.js";
import { runCommand } from "./commands/run.js";
import { shellCommand } from "./commands/shell.js";
import { whoamiCommand } from "./commands/whoami.js";

const VERSION = "0.3.1";

const HELP = `arker v${VERSION} — CLI for the Arker virtual computer platform

Usage:
  arker <command> [args] [options]

Commands:
  list                            List your VMs
  fork <source>                   Fork a VM from a source
  run <id> [options] <command>    Execute a command on a VM
  shell <id>                      Open an interactive shell to a VM
  sync read <id> <path>           Read a file from a VM (bytes → stdout)
  sync write <id> <path> <file>   Write a local file to a VM path
  delete <id>                     Delete a VM
  config {set,get,list} <key> [val] Manage CLI config
  whoami                          Show resolved config

Global flags:
  --help            Show help
  --version         Show version
  --json            Output raw JSON
  --no-color        Disable colored output
  --api-key KEY     Override API key for this invocation
  --region REGION   Override region for this invocation
  --base-url URL    Override base URL for this invocation
  --burst-base-url URL Override burst base URL for this invocation

Examples:
  arker config set api-key ark_live_...
  arker config set region aws-us-west-2
  arker fork ubuntu --name dev-box
  arker run 01ABC... --timeout 5000 echo hi
  arker sync read 01ABC... /home/user/x.txt > out.txt
  arker sync write 01ABC... /home/user/x.txt ./file.txt
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

  const overrides: ClientOverrides = {
    apiKey: getFlagString(args.flags, "api-key") ?? undefined,
    region: getFlagString(args.flags, "region") ?? undefined,
    baseUrl: getFlagString(args.flags, "base-url") ?? undefined,
    burstBaseUrl: getFlagString(args.flags, "burst-base-url") ?? undefined,
  };

  switch (args.command) {
    case "config":
      process.exit(handleConfigCommand(commandArgs(args.subcommand, args.positional), args.flags));
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
    case "shell":
      process.exit(await shellCommand(buildClient(overrides), args.positional, args.flags));
    case "sync":
      process.exit(await syncCommand(buildClient(overrides), args.subcommand, args.positional, args.flags));
    case "read-file":
      process.exit(await readFileCommand(buildClient(overrides), args.positional, args.flags));
    case "write-file":
      process.exit(await writeFileCommand(buildClient(overrides), args.positional, args.flags));
    default:
      console.error(`Unknown command: ${args.command}`);
      console.error("Run 'arker --help' for usage.");
      process.exit(1);
  }
}

function commandArgs(subcommand: string | null, positional: string[]): string[] {
  return subcommand ? [subcommand, ...positional] : positional;
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
