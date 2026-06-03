# CLAUDE.md — agent guide for mac-awake-mcp

Guidance for AI coding agents (and humans) working in this repository. Read this
first.

## What this is

An MCP (Model Context Protocol) server **and** CLI that keeps macOS awake while
an AI assistant works and grabs the user's attention when it needs them — using
only native macOS binaries (`caffeinate`, `osascript`, optional `swiftc`), so it
works on MDM-managed Macs. macOS-only (`"os": ["darwin"]`). See the
[README](README.md) for user docs and [docs/adr](docs/adr) for why things are
the way they are.

## Architecture (`src/`)

- `index.ts` — bin entry (`#!/usr/bin/env node`); delegates to `runCli`.
- `cli.ts` — CLI dispatch, flag parsing, and the hook subcommands
  (`keep-awake`, `release`, `on-notification`, `on-stop`, `flash`, `notify`,
  `status`, `setup`).
- `server.ts` — the MCP server and its five tools.
- `awake.ts` — keep-awake core: spawns/stops `caffeinate`, persists state under
  `~/.cache/mac-awake-mcp/`, reconciles stored state against the live process.
- `notify.ts` — `osascript` banners + the compiled-Swift full-screen flash.
- `proc.ts` — the **only** place subprocesses are launched (`execFile`).
- `hook.ts` — parses Claude Code hook payloads into banner content.
- `setup.ts` — builds the Claude Code hooks block + the `setup` text.
- `assets/flash.swift` — AppKit helper compiled on first `flash`.

## Non-negotiable invariants

1. **No shell, ever.** Launch processes only via `execFile`/`spawn` through
   `src/proc.ts`, passing dynamic values as discrete `args`. Never assemble a
   command string from input. See [SECURITY.md](SECURITY.md).
2. **AppleScript takes values via `on run argv`**, never interpolated into the
   script body (`src/notify.ts`).
3. **Hooks must never fail the session.** Hook subcommands are wrapped in
   `safe()` and tolerate empty/garbage stdin; missing payload fields degrade to
   sensible defaults.
4. **`SERVER_VERSION` (`src/server.ts`) stays in sync with `package.json`**
   (asserted by `test/version.test.ts`).
5. **Keep-awake always has a release path** (explicit stop, TTL, or watched PID
   exit) — never leave the Mac awake indefinitely.

## Build & test

```bash
npm install
npm run build         # tsc -> dist/, then chmod +x dist/index.js
npm run typecheck
npm test              # vitest
npm run test:coverage # with coverage thresholds
npm run format:check  # prettier (CI enforces this)
```

CI (`.github/workflows/ci.yml`) runs on `macos-latest`: format, typecheck, test
(with coverage), build, plus a dependency audit.

## Conventions

- TypeScript ESM, strict mode; no `any`. Prettier-formatted.
- Conventional Commits, in English (see [CONTRIBUTING.md](CONTRIBUTING.md)).
- Tests mock the macOS process layer so the suite is cross-platform and
  deterministic; add or update tests with any behaviour change.
- Record significant decisions as a new ADR in `docs/adr/`.
