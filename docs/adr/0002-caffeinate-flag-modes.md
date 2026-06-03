# 2. caffeinate flag modes: presentation vs compute

- Status: Accepted
- Date: 2026-06-03
- Deciders: Rocco Debellis

## Context

Two distinct needs exist: (a) keeping the **display** on and the screen unlocked
while a human watches or presents, and (b) keeping the **system** running for a
long background job while letting the display sleep. `caffeinate` exposes these
through different flags.

## Decision

Offer two named modes (`src/awake.ts`, `caffeinateFlags`):

- **presentation** → `caffeinate -d -i` — prevent display sleep (and therefore
  the screensaver and idle lock) plus idle system sleep.
- **compute** → `caffeinate -i -s -m` — keep the system and disk awake but let
  the display sleep.

The assertion is bound to the spawned `caffeinate` process and always has a
release path: `let_sleep`/`release`, an optional TTL (`-t`), or the watched PID
exiting (`-w`). PID reuse is guarded by checking that the tracked PID is still a
`caffeinate` process (`ps -o comm=`).

## Consequences

- `presentation` mirrors Keynote / fullscreen-video behaviour — predictable and
  familiar.
- The Mac is never silently kept awake forever: every assertion has a release.
- Mode names are part of the public tool/CLI contract; changing them is a
  breaking change.
