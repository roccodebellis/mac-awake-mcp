# Contributing to mac-awake-mcp

Thanks for your interest! This is a small, focused macOS tool — issues and pull
requests are welcome.

## Development setup

```bash
git clone https://github.com/roccodebellis/mac-awake-mcp.git
cd mac-awake-mcp
nvm use      # Node 22 (see .nvmrc)
npm install
npm run build
```

Useful scripts:

| Script                 | What it does                     |
| ---------------------- | -------------------------------- |
| `npm run build`        | Compile TypeScript to `dist/`    |
| `npm run dev`          | Compile in watch mode            |
| `npm run typecheck`    | Type-check without emitting      |
| `npm test`             | Run the Vitest suite once        |
| `npm run test:watch`   | Run tests in watch mode          |
| `npm run format`       | Format with Prettier             |
| `npm run format:check` | Verify formatting (what CI runs) |

## Code style

- TypeScript, ESM, strict mode. Keep it strict — no `any` escape hatches.
- Formatting is enforced by Prettier (`.prettierrc.json`); run `npm run format`
  before committing.
- Never build a shell command string from user input. Spawn binaries with
  `execFile`/`spawn` and pass dynamic values as separate `args` (see `src/proc.ts`),
  and pass AppleScript values via `on run argv` (see `src/notify.ts`).

## Tests

Pure logic is unit-tested and runs on any OS (`test/*.test.ts`). The macOS
process layer — spawning `caffeinate`, posting via `osascript`, compiling the
Swift flash — is currently exercised manually rather than in CI. **Guarded macOS
integration tests are a welcome contribution** (skip when not on `darwin` or when
the binary is missing).

## Pull requests

1. Fork and create a topic branch.
2. Make sure `npm run typecheck`, `npm test`, and `npm run format:check` pass.
3. If you touched the native layer, exercise it on a real Mac and say so in the PR.
4. Open the PR with the template filled in. Keep changes focused.

## Reporting bugs / ideas

Use the issue templates. For anything security-sensitive, see
[SECURITY.md](SECURITY.md) — please don't open a public issue.
