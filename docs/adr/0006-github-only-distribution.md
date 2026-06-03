# 6. GitHub-only distribution (no npm publish yet)

- Status: Accepted
- Date: 2026-06-03
- Deciders: Rocco Debellis

## Context

The package is public and MIT-licensed. Publishing to npm would add an ongoing
release cadence to maintain and an extra supply-chain surface (a registry
artifact to keep trustworthy), for a tool whose audience is comfortable cloning
a repo and running `npm install`.

## Decision

Distribute via the **public GitHub repository**: clone, `npm install`,
`npm run build`, then register with Claude Code. Keep `package.json`
publish-ready (`name`, `files`, `bin`, `publishConfig`) so publishing later is a
non-structural change, but do **not** publish to npm for now. The `npx` lines in
the docs are explicitly marked "once published".

## Consequences

- No release cadence or registry artifact to maintain today.
- Smaller supply-chain surface.
- Users build from source, which requires the toolchain described in the README.
- Revisiting this (publishing) is easy and would not require restructuring.
