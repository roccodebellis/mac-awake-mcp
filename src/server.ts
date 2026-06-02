import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { liveState, startAwake, status, stopAwake } from "./awake.js";
import { flash, notify } from "./notify.js";
import { CommandError } from "./proc.js";

export const SERVER_NAME = "mac-awake-mcp";
/** Keep in sync with package.json (asserted by test/version.test.ts). */
export const SERVER_VERSION = "0.1.0";

function ok(payload: unknown): CallToolResult {
  const text =
    typeof payload === "string" ? payload : JSON.stringify(payload, null, 2);
  return { content: [{ type: "text", text }] };
}

function fail(text: string): CallToolResult {
  return { content: [{ type: "text", text }], isError: true };
}

async function guard(
  body: () => Promise<CallToolResult>,
): Promise<CallToolResult> {
  try {
    return await body();
  } catch (err) {
    if (err instanceof CommandError) return fail(err.message);
    return fail(
      `Unexpected error: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/** Builds a fully configured server (transport not yet connected). */
export function createServer(): McpServer {
  const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });

  server.registerTool(
    "stay_awake",
    {
      title: "Keep this Mac awake",
      description:
        "Prevent the Mac from sleeping or locking while you work, using the native `caffeinate` " +
        "command (no third-party app — works under MDM). Call this before a long task or a " +
        "presentation. The assertion is bound to this MCP process, so it is released " +
        "automatically when the session ends; call let_sleep to release it sooner. " +
        "mode 'presentation' (default) keeps the display on and blocks the screen lock; " +
        "mode 'compute' lets the display sleep but keeps the system running for background work.",
      inputSchema: {
        mode: z
          .enum(["presentation", "compute"])
          .default("presentation")
          .describe(
            "'presentation' keeps the display/lock awake; 'compute' keeps only the system awake.",
          ),
        durationMinutes: z
          .number()
          .positive()
          .optional()
          .describe(
            "Optional safety cap: auto-release after this many minutes. Omit for no cap.",
          ),
      },
      annotations: { readOnlyHint: false, openWorldHint: true },
    },
    ({ mode, durationMinutes }) =>
      guard(async () => {
        const state = startAwake({
          mode,
          ttlSeconds:
            durationMinutes != null ? Math.round(durationMinutes * 60) : null,
          watchPid: process.pid,
        });
        return ok({
          ...state,
          note:
            mode === "presentation"
              ? "Display stays on and the screen will not lock."
              : "System stays awake; the display may still sleep.",
        });
      }),
  );

  server.registerTool(
    "let_sleep",
    {
      title: "Release keep-awake",
      description:
        "Release the keep-awake assertion so the Mac can sleep and lock normally again. " +
        "Call this when you finish a task or when you are about to wait for the user.",
      inputSchema: {},
      annotations: { readOnlyHint: false, openWorldHint: true },
    },
    () =>
      guard(async () => {
        const result = stopAwake();
        return ok({
          released: result.stopped,
          previousPid: result.pid,
          ...liveState(),
        });
      }),
  );

  server.registerTool(
    "awake_status",
    {
      title: "Keep-awake status",
      description:
        "Report whether keep-awake is currently active (mode, PID, since when, TTL) plus a " +
        "snapshot of the matching macOS power assertions from `pmset`.",
      inputSchema: {},
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    () =>
      guard(async () => {
        const { state, assertions } = await status();
        return ok({ ...state, assertions });
      }),
  );

  server.registerTool(
    "notify",
    {
      title: "Show a notification",
      description:
        "Post a macOS Notification Center banner to get the user's attention — e.g. when you " +
        "need input or have finished. Uses native `osascript`. The host app (your terminal or " +
        "Claude) may need Notifications permission the first time.",
      inputSchema: {
        message: z.string().min(1).describe("Body text of the notification."),
        title: z.string().optional().describe("Title (default 'Claude')."),
        subtitle: z.string().optional().describe("Optional subtitle."),
        sound: z
          .string()
          .optional()
          .describe(
            "macOS sound name (e.g. 'Glass', 'Ping'). Omit or '' for silent.",
          ),
      },
      annotations: { readOnlyHint: false, openWorldHint: true },
    },
    ({ message, title, subtitle, sound }) =>
      guard(async () => {
        await notify({ message, title, subtitle, sound });
        return ok({ posted: true, title: title ?? "Claude", message });
      }),
  );

  server.registerTool(
    "flash",
    {
      title: "Flash the screen",
      description:
        "Flash the whole screen (every display) a few times as a hard-to-miss visual alert — " +
        "useful when the user is away from the keyboard. Falls back to audible beeps if the " +
        "Swift toolchain is unavailable.",
      inputSchema: {
        count: z
          .number()
          .int()
          .min(1)
          .max(10)
          .optional()
          .describe("How many times to flash (default 3)."),
      },
      annotations: { readOnlyHint: false, openWorldHint: true },
    },
    ({ count }) =>
      guard(async () => {
        const method = await flash(count ?? 3);
        return ok({ flashed: true, method });
      }),
  );

  return server;
}
