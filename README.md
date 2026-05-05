# arker — CLI

Command-line client for the [Arker](https://arker.ai) virtual computer
platform. Spawn sandboxed VMs, run shell/Python/Node code, read and
write files — all from your terminal. Thin shell over
[`@arker-ai/sdk`](https://www.npmjs.com/package/@arker-ai/sdk).

## Install

```bash
npm install -g @arker-ai/cli
# or:  bun add -g @arker-ai/cli, pnpm add -g @arker-ai/cli, npx @arker-ai/cli ...
```

Requires Node ≥ 18. The package is named `@arker-ai/cli`; the binary
on your `$PATH` is `arker`.

## Configure

Three ways, highest precedence first:

1. Per-invocation flag: `arker --api-key ark_live_... list`
2. Env var: `ARKER_API_KEY=ark_live_... arker list`
3. Persisted config (most common): `arker config set api-key ark_live_...`

Config lives in `~/.arker/config`. The base URL defaults to
`https://aws-burst-us-west-2.arker.ai` and rarely needs overriding.

```bash
arker config set api-key ark_live_...
arker whoami
# API key:  ark_...QLVH
# Base URL: https://aws-burst-us-west-2.arker.ai
```

## Quickstart

```bash
# Fork a VM from the public arkuntu template, capture just the ID
ID=$(arker fork arkuntu --name hello --field id)

# Run code
arker run "$ID" 'python3 -c "print(2+2)"'        # → 4
arker run "$ID" 'echo hi'                         # → hi
arker run "$ID" 'ls -la /home/user/'

# Write & read files
arker write-file "$ID" /home/user/data.csv 'a,b\n1,2\n'
arker read-file  "$ID" /home/user/data.csv > local-copy.csv
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

Global flags: `--help`, `--version`, `--json`, `--field NAME`,
`--no-color`, `--api-key KEY`, `--base-url URL`.

### `fork`

`fork` creates a new VM by branching from a parent. The first VM in
your account is born by forking a public template (default name:
`arkuntu`). After that, any VM is one fork away from any other.

```bash
arker fork arkuntu --name first-sandbox
arker fork "$ID" --name child --region us-west-2
arker fork arkuntu --public --name shared-template    # let other orgs fork it
```

Default output: success message on stderr, the new VM's ID on stdout —
so `$()` capture works without any flags. Use `--field id` for an
explicit, message-free form.

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

# Bound the run
arker run "$ID" 'sleep 60' --timeout 5000             # 5-second timeout
```

### File ops

Bytes, both directions. `write-file` accepts inline data, `-` for
stdin, or omitted (also stdin):

```bash
# Inline string (multi-line OK)
arker write-file "$ID" /home/user/notes.md '# inline
multi-line
content'

# Pipe a local file in
cat large.bin | arker write-file "$ID" /home/user/large.bin -

# Or via shell redirection
arker write-file "$ID" /home/user/large.bin < large.bin

# read-file emits raw bytes — redirect to a local file
arker read-file "$ID" /home/user/data.csv > local-copy.csv

# Round-trip
arker write-file "$ID" /home/user/x.bin < input.bin
arker read-file  "$ID" /home/user/x.bin > output.bin
diff input.bin output.bin                              # silent → identical
```

The SDK auto-picks chunk fast-path (≤ 4 MB) vs presigned-bypass
(> 4 MB) under the hood — large files don't traverse the API layer.

### `list`

Paginated VM list. Default sort is `-created_at` (newest first).

```bash
arker list                                            # table
arker list --limit 50 --sort -created_at
arker list --q "experiment-2026"                      # name search
```

### `delete`

```bash
arker delete "$ID"
# Deleted 01KQX...
```

Idempotent: deleting an already-gone VM returns `not_found` (CLI exits
non-zero); silence it with `arker delete "$ID" 2>/dev/null || true`.

## Scripting & machine-readable output

Two flags cover the common patterns.

### `--field NAME` — extract one property as plain text

No jq required. For arrays (e.g. `list`), prints one value per line.
For `Uint8Array` fields (`run` `stdout`/`stderr`), writes raw bytes.

```bash
ID=$(arker fork arkuntu --field id)                   # capture ID
arker list --field vm_id                              # one ID per line
arker list --field name                               # one name per line
arker run "$ID" 'echo hi' --field stdout              # just the bytes
arker run "$ID" 'date +%s' --field exitCode           # just "0"
arker whoami --field apiKey                           # masked key
arker whoami --field baseUrl                          # current base URL
```

Field names per command:

| Command | Available `--field` values |
|---|---|
| `arker fork` | `id` |
| `arker list` | `vm_id`, `name`, `base_image`, `region`, `created_at` (per item) |
| `arker run` | `stdout`, `stderr`, `exitCode`, `durationMs`, `sessionId`, `cwd` |
| `arker whoami` | `apiKey`, `baseUrl` |

### `--json` — full structured output

```bash
arker list --json | jq '.items[] | {id: .vm_id, name}'
arker fork arkuntu --json                              # {"id":"01KQ..."}
arker run "$ID" 'echo hi' --json                       # full RunResult
arker whoami --json
```

### Implicit stdout/stderr separation

Status messages (`Forked X → Y`, `Deleted X`) go to **stderr**;
structured values go to **stdout**. So shell capture works for
default-mode commands without any flags:

```bash
ID=$(arker fork arkuntu --name hello)                  # ID on stdout (works)
arker fork arkuntu --name hello 2>/dev/null            # suppress the success line
```

`--field id` is the explicit, future-proof form. The bare `$()` is
the implicit, terse form. Use whichever fits.

## Errors

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
4. Built-in default (`base-url` → `https://aws-burst-us-west-2.arker.ai`)

## See also

- [`@arker-ai/sdk`](https://www.npmjs.com/package/@arker-ai/sdk) — the
  underlying TypeScript SDK; use this if you're embedding Arker in
  your own app.
- [`arker` on PyPI](https://pypi.org/project/arker/) — Python SDK with
  the same surface.
- [arker.ai](https://arker.ai) — docs, dashboard, billing.
- [github.com/ArkerHQ/arker-cli](https://github.com/ArkerHQ/arker-cli)
  — source, issues.

## License

Apache-2.0.
