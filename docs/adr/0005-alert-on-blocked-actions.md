# 5. Alert when an action needs the user

- Status: Accepted
- Date: 2026-06-03
- Deciders: Rocco Debellis

## Context

The point of the tool is to grab your attention when the assistant needs you.
Permission **prompts** already fire Claude Code's `Notification` event, so the
flash + banner already cover them. The gap is **auto permission mode**: when the
classifier _blocks_ a tool call, the turn can sit silently waiting for a decision
with no signal to the user.

## Decision

Wire the `PermissionDenied` hook to the same handler as `Notification`
(`on-notification`: flash + banner, then release keep-awake). When the payload
has no human-readable message, phrase one from the event and tool name, e.g.
_"Approval needed: Bash"_ (`src/hook.ts`, `attentionMessage`).

## Consequences

- A blocked action surfaces immediately instead of stalling silently.
- `PermissionDenied` fires only in auto permission mode; in interactive mode the
  `Notification` event already covers prompts.
- `AskUserQuestion` (a normal tool call) has **no dedicated hook event**, so it
  cannot trigger its own banner. This limitation is documented in the README
  rather than worked around.
