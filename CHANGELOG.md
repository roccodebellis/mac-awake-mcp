# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Alert on the `PermissionDenied` hook (auto permission mode): when the auto-mode
  classifier blocks a tool call, flash + banner so an action that now needs your
  decision doesn't sit there silently. The banner names the blocked tool
  (e.g. "Approval needed: Bash"). Permission _prompts_ were already covered by the
  `Notification` hook. `AskUserQuestion` has no hook event, so it can't be caught.

## [0.1.0] - 2026-06-03

Initial public release.

### Added

- Keep the Mac awake with the native `caffeinate` power assertion — no
  third-party app, so it works under MDM. Two modes: `presentation` (display +
  screen-lock stay awake) and `compute` (system stays awake, display may sleep).
- MCP server exposing five tools: `stay_awake`, `let_sleep`, `awake_status`,
  `notify`, `flash`.
- Desktop notifications via `osascript` and a full-screen visual flash across
  every display via a cached, compiled Swift helper (falls back to beeps when the
  Swift toolchain is unavailable).
- Claude Code hooks for a fully automatic lifecycle: keep-awake while the agent
  works, flash when it needs you, notify when it finishes, and release the
  assertion when idle.
- Session-aware notifications: the Notification/Stop hooks read the project from
  the hook payload's `cwd` and surface it (e.g. "Claude · P001"), including the
  original message and a subagent label when present.
- CLI (`mac-awake-mcp`) with `serve`, `keep-awake`, `release`, `status`,
  `notify`, `flash`, and `setup` subcommands.

### Security

- All subprocesses run via `execFile`/`spawn` (never a shell); AppleScript values
  are passed through `on run argv`, never interpolated into the script body.
