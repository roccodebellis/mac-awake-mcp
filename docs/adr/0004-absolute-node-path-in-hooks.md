# 4. Absolute node path in generated hooks

- Status: Accepted
- Date: 2026-06-03
- Deciders: Rocco Debellis

## Context

In automatic mode the tool is wired into Claude Code's session lifecycle via
hooks. Claude Code runs hooks with whatever environment it was launched in,
which often lacks `nvm`/Homebrew on `PATH`. A hook command that starts with a
bare `node` then fails to resolve the interpreter and **silently no-ops** — the
worst kind of failure, because keep-awake just quietly stops working.

## Decision

Generate hook commands with an **absolute** node path (`process.execPath`) and
an absolute script path, both `JSON.stringify`-quoted so paths containing spaces
are safe (`src/setup.ts`, `buildHooks`). The `setup` command prints the block
pre-filled with these absolute paths.

## Consequences

- Hooks fire reliably regardless of the launch environment.
- The generated command is environment-specific (it embeds the current node
  path), which is exactly what we want for a local settings file.
- Tests assert the command starts with a quoted absolute path and never a bare
  `node ` (`test/setup.test.ts`).
