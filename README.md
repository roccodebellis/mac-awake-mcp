# mac-awake-mcp

[![CI](https://github.com/roccodebellis/mac-awake-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/roccodebellis/mac-awake-mcp/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
![Platform: macOS](https://img.shields.io/badge/platform-macOS-lightgrey)
![Node ≥ 18](https://img.shields.io/badge/node-%E2%89%A518-brightgreen)

A [Model Context Protocol](https://modelcontextprotocol.io) server that lets an AI
assistant (Claude Code, Claude Desktop, …) **keep your Mac awake while it works** and
**grab your attention when it needs you** — without installing any third-party app.

It wraps two binaries that ship with macOS:

- [`caffeinate`](https://ss64.com/mac/caffeinate.html) — creates the same IOKit power
  assertion (`PreventUserIdleDisplaySleep`) that Keynote uses in presentation mode or a
  fullscreen video, so the display stays on and the screen won't lock.
- `osascript` — posts Notification Center banners.

Because it uses only native tooling, **it works on MDM-managed (enterprise) Macs** where
apps like Caffeine or Amphetamine are blocked. `caffeinate` is part of the OS, not an app.

## Requirements

- macOS
- Node.js ≥ 18
- (Optional) Xcode Command Line Tools for the full-screen `flash` — without them, `flash`
  falls back to audible beeps. Everything else needs no extra tooling.

## Install

```sh
git clone https://github.com/roccodebellis/mac-awake-mcp.git
cd mac-awake-mcp
npm install
npm run build
```

(Once published: `npx -y @roccodebellis/mac-awake-mcp`.)

## Register with Claude Code

```sh
claude mcp add mac-awake -- node /absolute/path/to/mac-awake-mcp/dist/index.js serve
```

Run `node dist/index.js setup` to print the exact command for your install plus the
optional hooks block (below).

## Tools

| Tool           | What it does                                                                                                                                                                                                                                                                     |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `stay_awake`   | Keep the Mac awake. `mode: "presentation"` (default) keeps the display on and blocks the lock; `mode: "compute"` keeps only the system awake for background work. Optional `durationMinutes` safety cap. Bound to the server process, so it auto-releases when the session ends. |
| `let_sleep`    | Release the keep-awake assertion so the Mac can sleep/lock normally again.                                                                                                                                                                                                       |
| `awake_status` | Report whether keep-awake is active (mode, PID, since, TTL) + the matching `pmset` assertions.                                                                                                                                                                                   |
| `notify`       | Post a Notification Center banner (`message`, `title`, `subtitle`, `sound`).                                                                                                                                                                                                     |
| `flash`        | Flash every display a few times as a hard-to-miss visual alert (`count`).                                                                                                                                                                                                        |

## Automatic mode (recommended)

Tools only fire when the assistant _chooses_ to call them. To make keep-awake **automatic**,
wire it to Claude Code's session lifecycle with hooks. Merge this into your Claude Code
`settings.json` — run `node dist/index.js setup` to print it with **absolute paths for both
`node` and the script** already filled in. (The absolute `node` path matters: Claude Code
runs hooks under a minimal `PATH` where a bare `node` often isn't found, so the hook would
fail silently.)

```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node /abs/dist/index.js keep-awake --ttl 900"
          }
        ]
      }
    ],
    "PreToolUse": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node /abs/dist/index.js keep-awake --ttl 900"
          }
        ]
      }
    ],
    "Notification": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node /abs/dist/index.js on-notification"
          }
        ]
      }
    ],
    "PermissionDenied": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node /abs/dist/index.js on-notification"
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [{ "type": "command", "command": "node /abs/dist/index.js on-stop" }]
      }
    ]
  }
}
```

Behaviour:

- **While Claude works** (each prompt / tool call) → keep the Mac awake, refreshed with a
  rolling `--ttl` (default 900s). If Claude goes idle for longer than the TTL, the assertion
  lapses and the Mac can lock again.
- **When Claude needs you** (`Notification`) → flash the screen and post Claude's own message
  as a banner, then release keep-awake so the Mac can lock while it waits for you. This already
  covers permission _prompts_: an approval dialog is sent as a `Notification`.
- **When the auto-mode classifier blocks an action** (`PermissionDenied`, auto permission mode
  only) → same flash + banner (e.g. _"Approval needed: Bash"_), so an action that was denied
  and now needs your decision doesn't sit there silently. Then release.
- **When Claude finishes** (`Stop`) → post a "finished" banner, then release.

These banners are **session-aware**: they read the project from the hook payload's `cwd` and
put it in the title (e.g. **"Claude · P001"**), so when several Claude sessions run at once you
can tell which one is calling. Sub-agent notifications add a `subagent: …` subtitle, the
Notification banner carries Claude's original message, and a `PermissionDenied` banner names
the blocked tool.

> **Note — what _can't_ be caught.** `AskUserQuestion` (when Claude asks you a multiple-choice
> question) is a normal tool call with no dedicated hook event, so it can't trigger its own
> banner. Permission _prompts_ and auto-mode _denials_ are covered by the two hooks above.

## CLI

```
mac-awake-mcp serve                 # run the MCP server (stdio) — default
mac-awake-mcp keep-awake [--ttl N] [--mode presentation|compute]
mac-awake-mcp release
mac-awake-mcp status
mac-awake-mcp notify --message "…" [--title "…"] [--subtitle "…"] [--sound Glass]
mac-awake-mcp flash [--count N]
mac-awake-mcp setup                 # print MCP + hooks setup
```

## How it works

`caffeinate` creates an IOKit power assertion. You can see it live with
`pmset -g assertions`. The two modes map to different flags:

- **presentation** → `caffeinate -d -i` — prevents display sleep (and therefore the
  screensaver and idle lock) plus idle system sleep. This is exactly what a fullscreen
  video or a Keynote slideshow does.
- **compute** → `caffeinate -i -s -m` — keeps the system and disk awake but lets the
  display sleep, for long background jobs.

The assertion is released when you call `let_sleep`/`release`, when the optional TTL
expires, or when the watched process exits — so it never silently keeps your Mac awake
forever.

### MDM caveat

Power assertions are honoured on managed Macs (verified on a current enterprise build).
However, if your MDM enforces a **hard lock-on-timer** policy that is independent of display
sleep, that lock can still fire. In the common case (lock tied to display sleep /
screensaver) `presentation` mode keeps the screen alive as expected.

### `flash`

The first `flash` compiles a tiny Swift/AppKit helper to `~/.cache/mac-awake-mcp/flash`
(≈ a few seconds, once) and reuses the compiled binary afterwards (milliseconds). If the
Swift toolchain isn't installed, `flash` falls back to audible beeps.

## Notifications & Apple Watch

Banners are posted with `osascript`, so they show up in macOS Notification Center like any
other app alert. macOS **does not mirror its own notifications to a paired Apple Watch** — the
Watch only mirrors _iPhone_ notifications, and that routing is governed by the system, not
something a script can opt into. So a `notify`/`flash` alert lands on the Mac (with its
sound), but not on your wrist.

If you want an alert that reaches your phone or Watch, the plan is an **optional** push
channel (e.g. [ntfy](https://ntfy.sh) or a Telegram bot) that the Notification/Stop hooks can
fan out to — opt-in and off by default, so the core tool stays network-free. See the roadmap.

## Roadmap

- **Optional push routing** — fan Notification/Stop events out to ntfy / Telegram / Pushover
  so alerts can reach a phone or Apple Watch, opt-in and off by default.
- **Presence-aware notifications** — skip the flash when the screen is already unlocked and
  you're clearly at the keyboard.
- **Power-source awareness** — different defaults on battery vs. AC power.
- **Quiet hours** — a scheduled window where keep-awake and flash are suppressed.
- **Signed helper app** — ship the flash helper as a tiny signed app bundle so banners show a
  proper icon instead of the generic Script Editor one.
- **Guarded macOS integration tests** — exercise the real `caffeinate` / `osascript` / Swift
  path on macOS CI runners (skipped elsewhere).

## License

MIT © Rocco De Bellis
