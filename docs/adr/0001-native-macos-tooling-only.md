# 1. Native macOS tooling only (MDM-safe)

- Status: Accepted
- Date: 2026-06-03
- Deciders: Rocco Debellis

## Context

The tool was born to keep a **work Mac managed by MDM** awake. On managed Macs,
third-party keep-awake apps (Caffeine, Amphetamine, …) are commonly blocked, and
installing software or kernel/login items may require admin rights the user does
not have. We need a keep-awake and attention mechanism with **zero install
footprint** and **no privileges**.

## Decision

Wrap only binaries that ship with macOS:

- `caffeinate` — creates the same IOKit power assertion Keynote/fullscreen video
  use, to keep the display and/or system awake.
- `osascript` — posts Notification Center banners.
- `swiftc` (optional) — compiles a tiny AppKit helper for the full-screen flash;
  if the toolchain is absent, `flash` falls back to audible beeps.

No background app, no login item, no kernel extension, no admin rights. The
package declares `"os": ["darwin"]`.

## Consequences

- Works on MDM-managed Macs: there is nothing for the MDM to allow-list, because
  `caffeinate` is part of the OS, not an app.
- macOS-only by design.
- A hard MDM "lock on a fixed timer" policy that is independent of display sleep
  can still lock the screen; this is documented as a caveat.
- The flash feature degrades gracefully (beeps) without Xcode Command Line Tools.
