# Architecture Decision Records

This directory records the significant decisions behind `mac-awake-mcp`, in a
lightweight [MADR](https://adr.github.io/madr/)-style format: **Context**,
**Decision**, **Consequences**. Records are immutable once accepted; if a later
decision changes course, add a new ADR that supersedes the old one rather than
editing history.

| ADR                                         | Title                                          | Status   |
| ------------------------------------------- | ---------------------------------------------- | -------- |
| [0001](0001-native-macos-tooling-only.md)   | Native macOS tooling only (MDM-safe)           | Accepted |
| [0002](0002-caffeinate-flag-modes.md)       | caffeinate flag modes: presentation vs compute | Accepted |
| [0003](0003-mcp-tool-surface.md)            | A small, explicit five-tool MCP surface        | Accepted |
| [0004](0004-absolute-node-path-in-hooks.md) | Absolute node path in generated hooks          | Accepted |
| [0005](0005-alert-on-blocked-actions.md)    | Alert when an action needs the user            | Accepted |
| [0006](0006-github-only-distribution.md)    | GitHub-only distribution (no npm publish yet)  | Accepted |
