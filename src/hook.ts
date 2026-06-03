import type { NotifyOptions } from "./notify.js";

/**
 * The subset of the JSON payload Claude Code writes to a hook's stdin that we
 * use to give the alert some context. All fields are optional: hooks must never
 * fail just because the payload changed shape, so unknown/missing fields degrade
 * to sensible defaults.
 * See https://code.claude.com/docs/en/hooks
 */
export interface HookPayload {
  /** Opaque session identifier (UUID-like, not human-readable). */
  readonly session_id?: string;
  /** Absolute working directory of the session — our best "which project" signal. */
  readonly cwd?: string;
  readonly hook_event_name?: string;
  /** Human-readable text (Notification event only). */
  readonly message?: string;
  readonly notification_type?: string;
  /** Tool that triggered a PermissionRequest / PermissionDenied event, when present. */
  readonly tool_name?: string;
  /** Present when a subagent triggered the event. */
  readonly agent_type?: string;
}

/** Parses a hook stdin payload, tolerating empty/garbage input (returns {}). */
export function parseHookPayload(raw: string): HookPayload {
  if (!raw.trim()) return {};
  try {
    const value: unknown = JSON.parse(raw);
    return typeof value === "object" && value !== null ? (value as HookPayload) : {};
  } catch {
    return {};
  }
}

/** Friendly project name from a working directory: the trailing path segment. */
export function projectName(cwd?: string): string | undefined {
  if (!cwd) return undefined;
  const base = cwd
    .replace(/[/\\]+$/, "")
    .split(/[/\\]/)
    .pop();
  return base ? base : undefined;
}

/** "Claude · P001" when the project is known, otherwise just "Claude". */
function titleFor(payload: HookPayload): string {
  const project = projectName(payload.cwd);
  return project ? `Claude · ${project}` : "Claude";
}

function subtitleFor(payload: HookPayload): string {
  return payload.agent_type ? `subagent: ${payload.agent_type}` : "";
}

/**
 * Banner for the Stop event ("Claude finished"). Sounds, since no other hook
 * makes noise on Stop.
 */
export function stopNotification(payload: HookPayload): NotifyOptions {
  return {
    title: titleFor(payload),
    message: "Finished.",
    subtitle: subtitleFor(payload),
    sound: "Glass",
  };
}

/**
 * Best human-readable line for an "attention" banner. Notification events carry
 * Claude's own `message`; permission events (PermissionRequest / PermissionDenied)
 * have no message, so we phrase one from the event + the tool name, so you can
 * tell *what* needs you — e.g. an action the auto-mode classifier blocked.
 */
function attentionMessage(payload: HookPayload): string {
  const message = payload.message?.trim();
  if (message) return message;
  const tool = payload.tool_name?.trim();
  if (
    payload.hook_event_name === "PermissionDenied" ||
    payload.hook_event_name === "PermissionRequest"
  ) {
    return tool ? `Approval needed: ${tool}` : "Approval needed.";
  }
  return "Needs your attention.";
}

/**
 * Banner for events that mean "Claude needs you" — the Notification event and,
 * in auto mode, PermissionDenied (the classifier blocked an action you must
 * decide on). Carries the relevant message plus which project it came from.
 * Silent on purpose: the flash and any user-configured sound hook already cover
 * the audible side.
 */
export function attentionNotification(payload: HookPayload): NotifyOptions {
  return {
    title: titleFor(payload),
    message: attentionMessage(payload),
    subtitle: subtitleFor(payload),
    sound: "",
  };
}
