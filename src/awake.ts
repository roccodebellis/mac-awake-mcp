import { execFileSync, spawn } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { run } from "./proc.js";

/**
 * presentation — keep the *display* awake (also blocks the screensaver and the
 *   idle screen lock); this is the "Keynote presentation / fullscreen video"
 *   behaviour. compute — let the display sleep but keep the *system* running so
 *   long background work isn't suspended.
 */
export type AwakeMode = "presentation" | "compute";

export interface AwakeState {
  readonly active: boolean;
  readonly pid: number | null;
  readonly mode: AwakeMode | null;
  /** ISO timestamp of when the current assertion was (re)started. */
  readonly since: string | null;
  readonly ttlSeconds: number | null;
}

const INACTIVE: AwakeState = {
  active: false,
  pid: null,
  mode: null,
  since: null,
  ttlSeconds: null,
};

const STATE_DIR = join(
  process.env["XDG_STATE_HOME"] ?? join(homedir(), ".cache"),
  "mac-awake-mcp",
);
const STATE_FILE = join(STATE_DIR, "caffeinate.json");

/** Skip respawning if a matching assertion was refreshed more recently than this. */
const REFRESH_DEBOUNCE_MS = 60_000;

/**
 * Returns the `caffeinate` flags for a mode.
 * -d prevent display sleep, -i prevent idle system sleep,
 * -s prevent system sleep (on AC), -m prevent disk idle sleep.
 */
export function caffeinateFlags(mode: AwakeMode): string[] {
  return mode === "presentation" ? ["-d", "-i"] : ["-i", "-s", "-m"];
}

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return (err as NodeJS.ErrnoException).code === "EPERM";
  }
}

/** Guards against PID reuse: only act on a PID that is actually a caffeinate. */
function isOurCaffeinate(pid: number): boolean {
  try {
    const comm = execFileSync("ps", ["-p", String(pid), "-o", "comm="], {
      encoding: "utf8",
    }).trim();
    return comm.endsWith("caffeinate");
  } catch {
    return false;
  }
}

function readState(): AwakeState | null {
  if (!existsSync(STATE_FILE)) return null;
  try {
    return JSON.parse(readFileSync(STATE_FILE, "utf8")) as AwakeState;
  } catch {
    return null;
  }
}

function writeState(state: AwakeState): void {
  mkdirSync(STATE_DIR, { recursive: true });
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function clearState(): void {
  try {
    rmSync(STATE_FILE, { force: true });
  } catch {
    /* nothing to clear */
  }
}

/** Reconciles the stored state with the OS: a dead/recycled PID reads as inactive. */
export function liveState(): AwakeState {
  const st = readState();
  if (st && st.pid != null && isAlive(st.pid) && isOurCaffeinate(st.pid)) {
    return { ...st, active: true };
  }
  if (st) clearState();
  return INACTIVE;
}

export interface StartOptions {
  readonly mode?: AwakeMode;
  /** Auto-release after N seconds (caffeinate -t). Null/0 = no cap. */
  readonly ttlSeconds?: number | null;
  /** Release automatically when this PID exits (caffeinate -w). */
  readonly watchPid?: number | null;
}

/** Starts a fresh keep-awake assertion, replacing any existing tracked one. */
export function startAwake(opts: StartOptions = {}): AwakeState {
  const mode = opts.mode ?? "presentation";
  stopAwake(); // never stack caffeinate processes

  const args = caffeinateFlags(mode);
  if (opts.watchPid != null) args.push("-w", String(opts.watchPid));
  if (opts.ttlSeconds != null && opts.ttlSeconds > 0) {
    args.push("-t", String(Math.floor(opts.ttlSeconds)));
  }

  const child = spawn("caffeinate", args, { detached: true, stdio: "ignore" });
  child.unref();
  if (child.pid == null)
    throw new Error("Failed to launch caffeinate (no PID returned).");

  const state: AwakeState = {
    active: true,
    pid: child.pid,
    mode,
    since: new Date().toISOString(),
    ttlSeconds: opts.ttlSeconds ?? null,
  };
  writeState(state);
  return state;
}

/**
 * Refreshes keep-awake for event-driven callers (hooks). Debounced so a burst
 * of events doesn't churn caffeinate processes.
 */
export function keepAwakeRefresh(
  mode: AwakeMode,
  ttlSeconds: number,
): AwakeState {
  const st = liveState();
  if (st.active && st.mode === mode && st.since != null) {
    const ageMs = Date.now() - Date.parse(st.since);
    if (Number.isFinite(ageMs) && ageMs < REFRESH_DEBOUNCE_MS) return st;
  }
  return startAwake({ mode, ttlSeconds });
}

/** Stops the tracked assertion. Safe to call when nothing is running. */
export function stopAwake(): { stopped: boolean; pid: number | null } {
  const st = readState();
  const pid = st?.pid ?? null;
  if (pid != null && isAlive(pid) && isOurCaffeinate(pid)) {
    try {
      process.kill(pid, "SIGTERM");
    } catch {
      /* already exited */
    }
    clearState();
    return { stopped: true, pid };
  }
  clearState();
  return { stopped: false, pid };
}

/** Live state plus a best-effort snapshot of our caffeinate power assertions. */
export async function status(): Promise<{
  state: AwakeState;
  assertions: string;
}> {
  const state = liveState();
  let assertions = "(could not read `pmset -g assertions`)";
  try {
    const { stdout } = await run("pmset", ["-g", "assertions"]);
    const lines = stdout
      .split("\n")
      .filter((l) => /caffeinate/i.test(l))
      .map((l) => l.trim());
    assertions =
      lines.length > 0 ? lines.join("\n") : "(no caffeinate assertion active)";
  } catch {
    /* keep the fallback message */
  }
  return { state, assertions };
}
