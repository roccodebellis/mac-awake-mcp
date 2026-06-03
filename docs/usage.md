# User guide

How to install, register, and use `mac-awake-mcp` — as a Claude Code tool, as a
set of automatic hooks, and as a plain CLI.

> macOS only. See the [README](../README.md) for the high-level overview and
> [docs/adr](adr) for the reasoning behind the design.

## 1. Requirements

- macOS.
- Node.js ≥ 18 (the repo is developed on Node 22 — see `.nvmrc`).
- _(Optional)_ Xcode Command Line Tools for the full-screen `flash`. Without
  them, `flash` falls back to audible beeps; everything else works.

## 2. Install

```sh
git clone https://github.com/roccodebellis/mac-awake-mcp.git
cd mac-awake-mcp
npm install
npm run build
```

This compiles `dist/`. Note the absolute path to `dist/index.js` — you will use
it when registering the server and wiring hooks. Run `node dist/index.js setup`
at any time to print the exact commands for your machine.

## 3. Use it as a Claude Code tool (on demand)

Register the MCP server so Claude can call the tools when it decides to:

```sh
claude mcp add mac-awake -- node /absolute/path/to/mac-awake-mcp/dist/index.js serve
```

Then Claude has five tools:

| Tool           | What it does                                                               |
| -------------- | -------------------------------------------------------------------------- |
| `stay_awake`   | Keep the Mac awake. `mode: presentation` (default) keeps the display on    |
|                | and blocks the lock; `mode: compute` keeps only the system awake. Takes    |
|                | an optional `durationMinutes` safety cap.                                  |
| `let_sleep`    | Release the keep-awake assertion so the Mac can sleep/lock again.          |
| `awake_status` | Report whether keep-awake is active (mode, PID, since, TTL) + `pmset`.     |
| `notify`       | Post a Notification Center banner (`message`, `title`, `subtitle`, sound). |
| `flash`        | Flash every display a few times as a hard-to-miss visual alert (`count`).  |

The keep-awake assertion is bound to the server process, so it is released
automatically when the session ends.

## 4. Automatic mode (recommended)

To keep the Mac awake automatically while Claude works — and flash/notify when it
needs you or finishes — wire the CLI into Claude Code's hooks. Run:

```sh
node dist/index.js setup
```

and merge the printed `hooks` block into your Claude Code `settings.json`. It is
filled in with **absolute paths for both `node` and the script**, which matters:
Claude Code runs hooks under a minimal `PATH` where a bare `node` is often not
found, so a bare command would fail silently.

What the hooks do:

- **While Claude works** (`UserPromptSubmit`, `PreToolUse`) → keep the Mac awake,
  refreshed on a rolling TTL (default 900s). If Claude is idle longer than the
  TTL, the assertion lapses and the Mac can lock again.
- **When Claude needs you** (`Notification`) → flash + post Claude's message as a
  banner, then release keep-awake so the Mac can lock while it waits. This covers
  permission **prompts**.
- **When the auto-mode classifier blocks an action** (`PermissionDenied`, auto
  permission mode only) → same flash + banner (e.g. _"Approval needed: Bash"_).
- **When Claude finishes** (`Stop`) → post a "Finished." banner, then release.

Banners are **session-aware**: the project name (from the hook payload's `cwd`)
goes in the title, e.g. **"Claude · P001"**, so you can tell which session is
calling when several run at once.

> **What can't be caught:** `AskUserQuestion` (a multiple-choice question Claude
> asks you) is a normal tool call with no dedicated hook event, so it can't fire
> its own banner.

## 5. CLI reference

```
mac-awake-mcp serve                 # run the MCP server (stdio) — default
mac-awake-mcp keep-awake [--ttl N] [--mode presentation|compute]
mac-awake-mcp release
mac-awake-mcp status
mac-awake-mcp notify --message "…" [--title "…"] [--subtitle "…"] [--sound Glass]
mac-awake-mcp flash [--count N]
mac-awake-mcp setup                 # print MCP + hooks setup
```

`status` prints JSON: the keep-awake state plus the matching `pmset` assertions.

## 6. Troubleshooting

- **No notifications appear.** The host app (your terminal or Claude) needs
  Notification permission the first time: System Settings → Notifications.
- **`flash` only beeps.** The Swift toolchain isn't installed; install Xcode
  Command Line Tools (`xcode-select --install`) for the visual flash.
- **Hooks seem to do nothing.** Confirm the hook command uses an **absolute**
  node path — re-run `node dist/index.js setup` and copy the exact command.
- **The screen still locks under MDM.** If your MDM enforces a hard lock-on-timer
  policy independent of display sleep, that lock can still fire; `presentation`
  mode only guarantees the display/screensaver path.

## 7. Uninstall

```sh
claude mcp remove mac-awake          # if registered as an MCP server
rm -rf ~/.cache/mac-awake-mcp        # cached state + compiled flash helper
```

Then remove the `mac-awake-mcp` hook lines from your Claude Code `settings.json`.
