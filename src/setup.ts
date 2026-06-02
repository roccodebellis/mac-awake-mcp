import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** Absolute path to this package's compiled CLI entry (dist/index.js). */
export function binPath(): string {
  return join(dirname(fileURLToPath(import.meta.url)), "index.js");
}

interface CommandHook {
  readonly type: "command";
  readonly command: string;
}

/**
 * Builds the Claude Code `hooks` block that wires keep-awake/notify to the
 * session lifecycle:
 *  - prompt submitted / about to use a tool  -> keep the Mac awake (refreshed)
 *  - Claude needs the user (Notification)     -> flash + let it sleep again
 *  - Claude finished (Stop)                   -> notify "done" + let it sleep
 */
export function buildHooks(
  bin: string,
  ttlSeconds: number,
  nodeBin: string = process.execPath,
): Record<string, unknown> {
  // Hooks run with whatever environment Claude Code was launched in, which may
  // lack nvm/Homebrew on PATH. Invoke node by absolute path so the hook never
  // silently no-ops because `node` could not be resolved.
  const cmd = (sub: string): { hooks: CommandHook[] } => ({
    hooks: [
      {
        type: "command",
        command: `${JSON.stringify(nodeBin)} ${JSON.stringify(bin)} ${sub}`,
      },
    ],
  });
  return {
    hooks: {
      UserPromptSubmit: [cmd(`keep-awake --ttl ${ttlSeconds}`)],
      PreToolUse: [cmd(`keep-awake --ttl ${ttlSeconds}`)],
      Notification: [cmd("on-notification")],
      Stop: [cmd("on-stop")],
    },
  };
}

const DEFAULT_TTL_SECONDS = 900;

/** Human-readable setup instructions printed by the `setup` subcommand. */
export function setupText(): string {
  const bin = binPath();
  const node = process.execPath;
  const hooksJson = JSON.stringify(
    buildHooks(bin, DEFAULT_TTL_SECONDS, node),
    null,
    2,
  );
  return `mac-awake-mcp — setup

1) Register the MCP server with Claude Code (exposes stay_awake / let_sleep /
   awake_status / notify / flash as tools Claude can call on demand):

   claude mcp add mac-awake -- ${JSON.stringify(node)} ${JSON.stringify(bin)} serve

   (or, once published:  claude mcp add mac-awake -- npx -y @roccodebellis/mac-awake-mcp)

2) OPTIONAL — fully automatic mode. Merge this into your Claude Code
   settings.json ("hooks" key) to keep the Mac awake while Claude works and
   flash/notify when it needs you or finishes:

${hooksJson}

   Tune the TTL (seconds) to how long the Mac should stay awake after the last
   activity before it may lock again.
`;
}
