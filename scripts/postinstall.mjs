// Platform notice — runs after `npm install`.
//
// mac-awake-mcp only *functions* on macOS: it wraps the native `caffeinate` and
// `osascript` binaries. We deliberately do NOT set `"os": ["darwin"]` in
// package.json, because that makes `npm install` fail hard with EBADPLATFORM on
// Linux/Windows and in cross-platform CI (monorepos, lockfile audits, …).
//
// Instead the package installs everywhere and we print a friendly heads-up on
// non-macOS. This script must NEVER fail an install: it always exits 0.

if (process.platform !== "darwin") {
  process.stderr.write(
    `\n⚠️  mac-awake-mcp targets macOS only — it wraps the native ` +
      `\`caffeinate\`/\`osascript\`.\n` +
      `   Install succeeded, but the tools won't do anything on "${process.platform}".\n\n`,
  );
}

process.exit(0);
