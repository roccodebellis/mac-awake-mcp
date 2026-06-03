# Security Policy

## Supported versions

This project is pre-1.0; only the latest release on the `main` branch is supported.

## Reporting a vulnerability

Please report security issues **privately**, not as public GitHub issues:

- Preferred: open a [private security advisory](https://github.com/roccodebellis/mac-awake-mcp/security/advisories/new).
- Or email **rocdebellis@gmail.com** with details and reproduction steps.

You can expect an initial response within a few days. Please give a reasonable
window to fix the issue before any public disclosure.

## Security design notes

`mac-awake-mcp` runs local macOS binaries. It is built to avoid the classic
injection pitfalls:

- Subprocesses are launched with `execFile`/`spawn` and **never** a shell;
  dynamic values are passed as discrete `args`, so user/agent text is never
  interpreted by a shell (`src/proc.ts`).
- AppleScript receives its values through `on run argv`, never by string
  interpolation into the script body (`src/notify.ts`).
- The tool only manages power assertions (`caffeinate`) and posts notifications;
  it does not open the network or read your files.

If you spot a place where untrusted input could reach a shell or a script body,
that's a vulnerability — please report it.

## Supply chain

- Runtime dependencies are kept minimal (`@modelcontextprotocol/sdk` and `zod`)
  and audited in CI with `npm audit` (build fails on a high/critical advisory).
- [Dependabot](.github/dependabot.yml) proposes weekly updates for both npm
  packages and GitHub Actions.
- GitHub Actions are pinned to commit SHAs, not floating tags.

## Verifying a release

Each GitHub Release ships a `SHA256SUMS.txt`. After building from the tagged
source you can confirm your artifacts match what was published:

```sh
# from the repo root, on the release tag, with SHA256SUMS.txt from the Release:
shasum -a 256 -c SHA256SUMS.txt
```

Maintainers regenerate the file with `npm run checksums`.
