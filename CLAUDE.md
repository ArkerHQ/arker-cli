# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Package manager is **Bun** for scripts; runtime target is Node >= 18.

- `bun run build` — bundle `src/main.ts` → `dist/main.js` via esbuild (`build.ts`). Produces the executable installed as the `arker` bin.
- `bun run typecheck` — `tsc --noEmit`.
- `bun run test` — `vitest run`. Watch mode: `bun run test:watch`.
- `bun run verify` — test + typecheck + build. Runs automatically on `prepublishOnly`.
- Single test file: `bunx vitest run __tests__/commands.test.ts`. Single test name: `bunx vitest run -t "maps --session-id"`.

## Sibling SDK dependency

This CLI does **not** install `@arker-ai/sdk` from npm — both the build and the tests resolve the import to local source at `../arker-sdk/typescript/src/index.ts` (a sibling checkout of the `arker-sdk` repo). This is wired in three places that must stay in sync:

- `build.ts` — esbuild plugin remaps `@arker-ai/sdk` to the local entry. Build throws if the sibling path is missing.
- `vitest.config.ts` — same remap via Vite alias.
- `tsconfig.json` — `paths` mapping for typechecking.

If `../arker-sdk/typescript/src/index.ts` doesn't exist, none of build/test/typecheck will work. The package has no runtime `dependencies` because the SDK is bundled into `dist/main.js`.

## Architecture

The CLI is a thin dispatcher over the SDK. Each subcommand maps almost 1:1 to an SDK call — see the table in README.md. The flow is:

1. `src/main.ts` — parses args, resolves config overrides from flags, switches on `args.command`, and delegates to a handler in `src/commands/`. Every handler returns a numeric exit code; `main` passes it to `process.exit`.
2. `src/args.ts` — hand-rolled arg parser. Two non-obvious rules:
   - `run` is special-cased: after `<vm-id>` is consumed, everything else (including `--`-prefixed tokens) is treated as the remote command's argv. CLI flags for `run` (e.g. `--timeout`, `--session-id`) must appear **before** the remote command. See `parseRunPositional`.
   - `config` and `sync` shift the first positional into `subcommand` (`set`/`get`/`list`, `read`/`write`).
3. `src/config.ts` — config lives at `$ARKER_HOME/config` (defaults to `~/.arker/config`), JSON-encoded. `loadConfig` merges in priority order: explicit overrides → env vars (`ARKER_API_KEY`, `ARKER_REGION`, `ARKER_BASE_URL`, `ARKER_BURST_BASE_URL`) → file → defaults. `region` defaults to `aws-us-west-2` **only when no `base-url` is set** — a custom base URL suppresses the default region.
4. `src/client.ts` — `buildClient(overrides)` constructs an `Arker` SDK instance from resolved config. Throws if no API key is configured.
5. `src/output.ts` — shared stdout/stderr helpers. Convention used throughout commands: machine-consumable output (IDs, file bytes, JSON) goes to **stdout**; human-readable status, errors, and colored messages go to **stderr**. This is what makes patterns like `VM_ID=$(arker fork ubuntu)` work.

### Conventions to preserve when adding commands

- Handlers take `(arker, positional, flags)` and return `Promise<number>`. Wrap SDK calls in try/catch and convert errors to a stderr message + exit code 1.
- Honor `flags.json === true` for structured output; otherwise print human-readable form. For `run`, the JSON exit code still reflects the remote command's exit code.
- Don't print success chrome to stdout — it will pollute scripted captures. Use `printSuccess`/`printInfo` (stderr) for messages, and `console.log` / `process.stdout.write` only for the actual return value.
- Boolean flags must be registered in `BOOLEAN_FLAGS` in `args.ts`, otherwise the parser will consume the next token as their value.
