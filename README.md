# arker CLI

Command-line client for the [Arker](https://arker.ai) virtual computer
platform. The CLI is a thin wrapper over
[`@arker-ai/sdk`](https://www.npmjs.com/package/@arker-ai/sdk): it handles
config, arguments, and terminal output; routing and API behavior live in the
SDK.

## Install

```bash
npm install -g @arker-ai/cli
```

Requires Node >= 18. The package is named `@arker-ai/cli`; the binary is
`arker`.

## Configure

```bash
arker config set api-key ark_live_...
arker config set region aws-us-west-2
arker whoami
```

Config lives in `~/.arker/config`. `region` defaults to `aws-us-west-2`.
`base-url` and `burst-base-url` are internal/dev escape hatches and are not
needed for normal usage.

Precedence for each setting:

1. CLI flag: `--api-key`, `--region`, `--base-url`, `--burst-base-url`
2. Environment: `ARKER_API_KEY`, `ARKER_REGION`, `ARKER_BASE_URL`, `ARKER_BURST_BASE_URL`
3. Saved config
4. Default region: `aws-us-west-2`

## Quickstart

```bash
arker config set api-key ark_live_...
arker config set region aws-us-west-2

VM_ID=$(arker fork ubuntu --name dev-box)
arker run "$VM_ID" --timeout 5000 echo hello

arker sync write "$VM_ID" /home/user/file.txt ./file.txt
arker sync read "$VM_ID" /home/user/file.txt > downloaded.txt

arker list
arker delete "$VM_ID"
```

## Commands

| Command | SDK call |
|---|---|
| `arker fork <source> [--name <name>]` | `arker.vm(source).fork({ name })` |
| `arker run <vm-id> [--session-id <id>] [--timeout <ms>] <command> [args...]` | `arker.vm(vmId).run(command, options)` |
| `arker shell <vm-id> [--exit] [-- <command> [args...]]` | repeated `arker.vm(vmId).run(line, { session_id, timeout })` |
| `arker sync read <vm-id> <remote-path>` | `arker.vm(vmId).sync.readFile(path)` |
| `arker sync write <vm-id> <remote-path> <local-path>` | `arker.vm(vmId).sync.writeFile(path, data)` |
| `arker list` | `arker.list()` |
| `arker delete <vm-id>` | `arker.vm(vmId).delete()` |
| `arker config set <key> <value>` | CLI-only |
| `arker config get <key>` | CLI-only |
| `arker config list` | CLI-only |
| `arker whoami` | CLI-only |

Global flags:

```text
--api-key <key>
--region <region>
--base-url <url>
--burst-base-url <url>
--json
--no-color
--help
--version
```

## Output

Default output is human-readable. `fork` prints the new VM id to stdout so it
can be captured by shell scripts:

```bash
VM_ID=$(arker fork ubuntu --name dev-box)
```

Use `--json` when scripting against structured responses:

```bash
arker list --json
arker fork ubuntu --name dev-box --json
arker --json run "$VM_ID" echo hello
arker whoami --json
```

`run` prints completed stdout/stderr to the matching terminal streams and exits
with the command exit code. Background and PTY run results print their SDK ids
or connection details.

For `run`, CLI options go before the remote command. After the first command
token, everything belongs to the VM command:

```bash
arker run "$VM_ID" --timeout 5000 pytest -q --maxfail=1
arker run "$VM_ID" --timeout 5000 -- pytest -q --maxfail=1
```

## Shell

```bash
arker shell "$VM_ID"
arker --timeout 30000 shell "$VM_ID"
arker shell "$VM_ID" -- echo ready
arker shell "$VM_ID" --exit -- uname -a
```

`shell` opens an interactive REPL backed by the VM's `run` API. Each line you
type is sent as one `run` call, all sharing a single auto-generated
`session_id` so `cd`, `export`, and other shell state persist between lines.
The prompt is `arker@<short-vm-id>:<cwd>$` with the cwd shown relative to
`$HOME` (collapsed to `~`).

Type `exit` or press Ctrl+D to leave. The shell prints `Shell session ended`
on its way out.

Positional arguments after the vm-id are joined into a single command line and
executed after the welcome message, before the interactive prompt. Use `--` to
pass a command that contains `--`-prefixed flags. Pass `--exit` to run the
preloaded command and exit with its exit code, bash-`-c` style. Without
`--exit`, the shell drops into the interactive prompt after the command
finishes.

Notes and limitations:

- `--timeout` applies **per command**, not per session — every line you type
  is capped individually (this also caps the internal `pwd` refresh that
  updates the prompt).
- Each command is request/response. Long-running or interactive commands
  (`tail -f`, `top`, `vim`) will not stream output and will hit `--timeout`.
- Ctrl+C does not interrupt an in-flight remote command in this version;
  press it at an idle prompt to clear the current input line.
- Up-arrow history is available within the session but is not persisted to
  disk.
- Multi-line input (heredocs spanning lines, etc.) is not supported — each
  line is its own `run`.

## File Sync

```bash
arker sync write "$VM_ID" /home/user/data.csv ./data.csv
arker sync read "$VM_ID" /home/user/data.csv > data.csv
cat data.csv | arker sync write "$VM_ID" /home/user/data.csv -
```

The legacy aliases remain available:

```bash
arker read-file "$VM_ID" /home/user/data.csv
arker write-file "$VM_ID" /home/user/data.csv "inline text"
```

## Errors

The CLI exits non-zero on failure and prints the SDK error message to stderr:

```text
read-file failed: not_found: file not found: /home/user/missing
```

## License

Apache-2.0
