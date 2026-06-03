# 3. A small, explicit five-tool MCP surface

- Status: Accepted
- Date: 2026-06-03
- Deciders: Rocco Debellis

## Context

The server exposes capabilities to an AI assistant over the Model Context
Protocol. A large or implicit tool surface is hard for an assistant to reason
about safely and hard for a human to audit.

## Decision

Expose exactly five tools (`src/server.ts`): `stay_awake`, `let_sleep`,
`awake_status`, `notify`, `flash`.

- Inputs are validated with `zod` schemas.
- Results are structured JSON; failures are returned as `isError` text through a
  single `guard()` wrapper, so a `CommandError` never crashes the server.
- Each tool carries MCP annotations (`readOnlyHint`, `openWorldHint`);
  `awake_status` is read-only.

## Consequences

- Small, auditable, well-described surface an assistant can use predictably.
- Adding a tool is a deliberate, reviewed decision, not an accident.
- Errors are observable to the caller instead of taking down the stdio stream.
