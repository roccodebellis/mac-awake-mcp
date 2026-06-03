# Contributing to mac-awake-mcp

Thanks for your interest! This is a small, focused macOS tool — issues and pull
requests are welcome. By participating you agree to the
[Code of Conduct](CODE_OF_CONDUCT.md).

## Development setup

```bash
git clone https://github.com/roccodebellis/mac-awake-mcp.git
cd mac-awake-mcp
nvm use      # Node 22 (see .nvmrc)
npm install
npm run build
```

Useful scripts:

| Script                  | What it does                     |
| ----------------------- | -------------------------------- |
| `npm run build`         | Compile TypeScript to `dist/`    |
| `npm run dev`           | Compile in watch mode            |
| `npm run typecheck`     | Type-check without emitting      |
| `npm test`              | Run the Vitest suite once        |
| `npm run test:coverage` | Run tests with a coverage report |
| `npm run test:watch`    | Run tests in watch mode          |
| `npm run format`        | Format with Prettier             |
| `npm run format:check`  | Verify formatting (what CI runs) |

## Code style

- TypeScript, ESM, strict mode. Keep it strict — no `any` escape hatches.
- Formatting is enforced by Prettier (`.prettierrc.json`); run `npm run format`
  before committing.
- **Security invariant (non-negotiable):** never build a shell command string
  from dynamic input. Spawn binaries with `execFile`/`spawn` and pass dynamic
  values as separate `args` (see `src/proc.ts`); pass AppleScript values via
  `on run argv` (see `src/notify.ts`). More in [SECURITY.md](SECURITY.md).

## Commit messages

This project uses [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<optional scope>): <short summary in the imperative>
```

Common types: `feat`, `fix`, `docs`, `test`, `refactor`, `chore`, `ci`, `build`.
Examples:

- `feat(hooks): alert when an action is blocked in auto mode`
- `fix(awake): guard against PID reuse when stopping caffeinate`
- `docs(readme): document the Apple Watch limitation`

Keep each commit atomic — one logical change — and write messages in English.

## Opening an issue

Use the issue templates:

- **Bug report** — include your macOS and Node versions and the output of
  `mac-awake-mcp status`.
- **Feature request** — describe the problem first, then the proposed solution.

For anything security-sensitive, **do not open a public issue** — see
[SECURITY.md](SECURITY.md).

## Tests

Pure logic is unit-tested and runs on any OS (`test/*.test.ts`); the macOS
process layer is mocked so the suite stays cross-platform and deterministic.
Run `npm run test:coverage` and keep coverage at or above the configured
thresholds. The real native path (`caffeinate` / `osascript` / Swift flash) is
exercised manually on a Mac; **guarded macOS integration tests are a welcome
contribution** (skip when not on `darwin` or when the binary is missing).

## Pull requests

1. Fork and create a topic branch off `main`.
2. Make your change, with tests. Ensure `npm run typecheck`, `npm test`, and
   `npm run format:check` pass locally.
3. If you touched the native layer, exercise it on a real Mac and say so.
4. Open the PR with the template filled in. Keep changes focused — one concern
   per PR.

### How a pull request gets merged

`main` is a protected branch. A PR is merged once:

- CI is green (format, typecheck, tests, build on macOS).
- At least one maintainer review approves it.
- All review conversations are resolved.

Merges use a **merge commit** (no squash, no rebase) to preserve the reviewed
history, and the topic branch is **deleted automatically** afterward.

## Releasing (maintainers)

1. Update `CHANGELOG.md` (move `Unreleased` into a dated version) and bump
   `version` in `package.json`. It is kept in sync with `SERVER_VERSION`
   (asserted by `test/version.test.ts`).
2. Tag the release `vX.Y.Z` and push the tag.
3. Generate artifact checksums with `npm run checksums` and attach the
   resulting `SHA256SUMS.txt` to the GitHub Release.
