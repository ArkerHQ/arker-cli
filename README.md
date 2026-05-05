# arker — CLI

Command-line client for the [Arker](https://arker.ai) virtual computer
platform. Spawn sandboxed VMs, run shell/Python/Node code, read and
write files — all from your terminal. Thin shell over
[`@arker-ai/sdk`](https://www.npmjs.com/package/@arker-ai/sdk).

## Install

```bash
npm install -g @arker-ai/cli
# or: bun add -g @arker-ai/cli, pnpm add -g @arker-ai/cli
```

Requires Node ≥ 18. The package is named `@arker-ai/cli`; the binary
on your `$PATH` is `arker`.

## Configure

Once, then forget:

```bash
arker config set api-key ark_live_...
arker whoami
```

Or pass per-invocation: `arker --api-key ark_live_... list`. Or via
env: `ARKER_API_KEY=... arker list`. Config lives in `~/.arker/config`.

## Quickstart

```bash
# Create a VM by forking the public arkuntu template
arker fork arkuntu --name hello

# Returns the new VM's ULID; capture it for later commands
ID=$(arker fork arkuntu --name hello --json | jq -r .id)

# Execute code
arker run "$ID" 'python3 -c "print(2+2)"'
arker run "$ID" 'echo hi'
arker run "$ID" 'ls -la /home/user/'

# Write and read files (bytes, not strings — read-file → stdout)
arker write-file "$ID" /home/user/data.csv 'a,b\n1,2\n'
arker read-file  "$ID" /home/user/data.csv
echo "from stdin" | arker write-file "$ID" /home/user/x.txt -

# List, fork-of-fork, clean up
arker list --limit 10 --sort -created_at
arker fork "$ID" --name branch
arker delete "$ID"
```

## Commands

Every verb mirrors a single SDK method.

| Command | SDK equivalent |
|---|---|
| `arker list [--limit N --offset N --q TEXT --sort -created_at]` | `arker.list(...)` |
| `arker fork <id\|template> [--name N --region R --public]` | `arker.vm(id).fork(...)` |
| `arker run <id> <command> [--session-id S --timeout MS]` | `arker.vm(id).run(...)` |
| `arker read-file <id> <path>` | `arker.vm(id).sync.readFile(path)` |
| `arker write-file <id> <path> [data\|-]` | `arker.vm(id).sync.writeFile(path, data)` |
| `arker delete <id>` | `arker.vm(id).delete()` |
| `arker config {set,get} <key> [value]` | (CLI-only) |
| `arker whoami` | (CLI-only) |

Global flags: `--help`, `--version`, `--json` (machine-readable), `--no-color`,
`--api-key`, `--base-url`.

### `fork`

`fork` creates a new VM by branching from a parent. The first VM in
your account is born by forking a public template (default name:
`arkuntu`). After that, any VM is one fork away from any other.

```bash
arker fork arkuntu --name first-sandbox
arker fork "$ID" --name child --region us-west-2
```

### `run`

Standard output / standard error stream straight to your terminal;
the CLI exits with the run's exit code.

```bash
arker run "$ID" 'python3 -c "import platform; print(platform.python_version())"'
arker run "$ID" 'pip install requests && python3 -c "import requests; print(requests.__version__)"'
arker run "$ID" 'node -e "console.log(process.versions.node)"'
arker run "$ID" 'bash -c "for i in 1 2 3; do echo line-$i; done"'

# Pin a session for stateful REPLs
arker run "$ID" --session-id repl1 'x = 42'
arker run "$ID" --session-id repl1 'print(x)'        # → 42
```

### File ops

Bytes, both directions. `write-file` accepts inline data or `-` for
stdin (or omit the third arg entirely — same as `-`):

```bash
arker write-file "$ID" /home/user/notes.md '# inline
multi-line
content'

# Pipe in a local file
cat large.bin | arker write-file "$ID" /home/user/large.bin -

# Or:
arker write-file "$ID" /home/user/large.bin < large.bin

# read-file emits raw bytes — redirect to a local file:
arker read-file "$ID" /home/user/data.csv > local-copy.csv
```

### Machine-readable output

Every command accepts `--json`:

```bash
arker list --json | jq '.items[].vm_id'
arker fork arkuntu --json | jq -r .id
arker run "$ID" --json 'echo hi' | jq '.exitCode, .stdout'
```

### Errors

The CLI exits non-zero on failure and prints the SDK error code to
stderr:

```
$ arker read-file 01ABC /home/user/missing
read-file failed: not_found: file not found: /home/user/missing
```

Stable error codes: `bad_request`, `unauthorized`, `payment_required`,
`forbidden`, `not_found`, `conflict`, `payload_too_large`,
`internal`, `not_implemented`, `vm_busy`, `unsupported_*`,
`command_not_found`.

## Configuration precedence

For each setting, the first non-empty source wins:

1. CLI flag (`--api-key`, `--base-url`)
2. Env var (`ARKER_API_KEY`, `ARKER_BASE_URL`)
3. `~/.arker/config` (set via `arker config set ...`)
4. Built-in default (base URL → `https://aws-burst-us-west-2.arker.ai`)

## See also

- [`@arker-ai/sdk`](https://www.npmjs.com/package/@arker-ai/sdk) — the
  underlying TypeScript SDK; use this if you're embedding Arker in
  your own app.
- [`arker` on PyPI](https://pypi.org/project/arker/) — Python SDK with
  the same surface.
- [arker.ai](https://arker.ai) — docs, dashboard, billing.

## License

Apache-2.0.
