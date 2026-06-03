import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { AwakeMode } from "./awake.js";
import { keepAwakeRefresh, liveState, status, stopAwake } from "./awake.js";
import { attentionNotification, parseHookPayload, stopNotification } from "./hook.js";
import { flash, notify, warmFlash } from "./notify.js";
import { createServer, SERVER_NAME, SERVER_VERSION } from "./server.js";
import { setupText } from "./setup.js";

const USAGE = `${SERVER_NAME} v${SERVER_VERSION}

Usage: mac-awake-mcp <command> [options]

  serve                 Run the MCP server on stdio (default).
  keep-awake [--ttl N] [--mode presentation|compute]
                        Start/refresh keep-awake (for Claude Code hooks).
  release               Release keep-awake now.
  status                Print keep-awake state + pmset assertions as JSON.
  notify --message "…" [--title "…"] [--subtitle "…"] [--sound Glass]
                        Post a Notification Center banner.
  flash [--count N]     Flash every display N times (default 3).
  on-notification       Notify (project + message) + flash, then release (Notification hook).
  on-stop               Notify "finished in <project>", then release (Stop hook).
  setup                 Print MCP + hooks setup instructions.
  help                  Show this help.
`;

export function flagValue(args: readonly string[], name: string): string | undefined {
  const i = args.indexOf(name);
  if (i >= 0 && i + 1 < args.length) return args[i + 1];
  const prefix = `${name}=`;
  return args.find((a) => a.startsWith(prefix))?.slice(prefix.length);
}

export function numberFlag(args: readonly string[], name: string, fallback: number): number {
  const raw = flagValue(args, name);
  const n = raw != null ? Number(raw) : Number.NaN;
  return Number.isFinite(n) ? n : fallback;
}

export function modeFlag(args: readonly string[]): AwakeMode {
  return flagValue(args, "--mode") === "compute" ? "compute" : "presentation";
}

/** Runs a side-effecting subcommand without ever failing the hook that called it. */
async function safe(label: string, fn: () => Promise<void> | void): Promise<void> {
  try {
    await fn();
  } catch (err) {
    console.error(`${SERVER_NAME} ${label}:`, err instanceof Error ? err.message : err);
  }
}

/**
 * Reads a hook's JSON payload from stdin. Claude Code pipes the payload and
 * closes the stream; the timeout is a safety net, and a TTY (manual run) yields
 * "" immediately so the CLI never blocks waiting for input that won't come.
 */
async function readStdin(timeoutMs: number = 1000): Promise<string> {
  if (process.stdin.isTTY) return "";
  return new Promise<string>((resolve) => {
    let data = "";
    let settled = false;
    const done = (): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      process.stdin.removeAllListeners("data");
      process.stdin.removeAllListeners("end");
      process.stdin.removeAllListeners("error");
      process.stdin.pause();
      resolve(data);
    };
    const timer = setTimeout(done, timeoutMs);
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk: string) => {
      data += chunk;
    });
    process.stdin.on("end", done);
    process.stdin.on("error", done);
  });
}

async function serve(): Promise<void> {
  warmFlash(); // compile the flasher in the background so the first flash is instant
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // stdout is reserved for the JSON-RPC stream; logging goes to stderr.
  console.error(`${SERVER_NAME} v${SERVER_VERSION} running on stdio`);
}

export async function runCli(argv: readonly string[]): Promise<void> {
  const cmd = argv[0] ?? "serve";
  const rest = argv.slice(1);

  switch (cmd) {
    case "serve":
      return serve();

    case "keep-awake":
      return safe("keep-awake", () => {
        keepAwakeRefresh(modeFlag(rest), numberFlag(rest, "--ttl", 900));
      });

    case "release":
      return safe("release", () => {
        stopAwake();
      });

    case "on-notification":
      return safe("on-notification", async () => {
        const payload = parseHookPayload(await readStdin());
        await notify(attentionNotification(payload));
        await flash(3);
        stopAwake();
      });

    case "on-stop":
      return safe("on-stop", async () => {
        // Stop fires at the end of every turn; only announce "finished" when we
        // were actually keeping the Mac awake (i.e. a real working turn).
        const payload = parseHookPayload(await readStdin());
        const wasWorking = liveState().active;
        stopAwake();
        if (wasWorking) {
          await notify(stopNotification(payload));
        }
      });

    case "flash":
      return safe("flash", async () => {
        await flash(numberFlag(rest, "--count", 3));
      });

    case "notify":
      return safe("notify", async () => {
        await notify({
          message: flagValue(rest, "--message") ?? "Claude needs your attention.",
          title: flagValue(rest, "--title"),
          subtitle: flagValue(rest, "--subtitle"),
          sound: flagValue(rest, "--sound"),
        });
      });

    case "status": {
      process.stdout.write(`${JSON.stringify(await status(), null, 2)}\n`);
      return;
    }

    case "setup":
      process.stdout.write(`${setupText()}\n`);
      return;

    case "help":
    case "--help":
    case "-h":
      process.stdout.write(USAGE);
      return;

    default:
      process.stderr.write(`Unknown command: ${cmd}\n\n${USAGE}`);
      process.exitCode = 2;
      return;
  }
}
