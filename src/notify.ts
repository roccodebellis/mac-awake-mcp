import { existsSync, mkdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { run } from "./proc.js";

/**
 * AppleScript that reads its arguments from `on run argv` instead of having
 * them interpolated into the script body — user-controlled text never becomes
 * AppleScript source.
 */
const NOTIFY_SCRIPT = `on run argv
  set theMessage to item 1 of argv
  set theTitle to item 2 of argv
  set theSubtitle to item 3 of argv
  set theSound to item 4 of argv
  if theSound is "" then
    display notification theMessage with title theTitle subtitle theSubtitle
  else
    display notification theMessage with title theTitle subtitle theSubtitle sound name theSound
  end if
end run`;

export interface NotifyOptions {
  readonly message: string;
  readonly title?: string;
  readonly subtitle?: string;
  /** A macOS system sound name (e.g. "Glass", "Ping"). Empty string = silent. */
  readonly sound?: string;
}

/** Posts a Notification Center banner via `osascript`. */
export async function notify(opts: NotifyOptions): Promise<void> {
  await run("osascript", [
    "-e",
    NOTIFY_SCRIPT,
    opts.message,
    opts.title ?? "Claude",
    opts.subtitle ?? "",
    opts.sound ?? "",
  ]);
}

/** Absolute path to the bundled Swift flasher source (shipped in assets/). */
function flashSourcePath(): string {
  return join(dirname(fileURLToPath(import.meta.url)), "..", "assets", "flash.swift");
}

function flashBinaryPath(): string {
  const base = process.env["XDG_CACHE_HOME"] ?? join(homedir(), ".cache");
  return join(base, "mac-awake-mcp", "flash");
}

/**
 * Compiles the Swift flasher to a cached native binary. Running the `swift`
 * interpreter directly costs ~20s per call (it recompiles Cocoa every time);
 * the compiled binary runs in milliseconds. Recompiles only when the source
 * changes. Returns null if the Swift toolchain is unavailable.
 */
async function ensureFlashBinary(): Promise<string | null> {
  const src = flashSourcePath();
  if (!existsSync(src)) return null;
  const out = flashBinaryPath();
  try {
    if (existsSync(out) && statSync(out).mtimeMs >= statSync(src).mtimeMs) return out;
    mkdirSync(dirname(out), { recursive: true });
    await run("swiftc", ["-O", src, "-o", out], 120_000);
    return out;
  } catch {
    return null;
  }
}

/** Compiles the flasher ahead of time (fire-and-forget) so the first flash is fast. */
export function warmFlash(): void {
  void ensureFlashBinary().catch(() => undefined);
}

export type FlashMethod = "swift" | "beep";

/**
 * Grabs attention with a full-screen visual flash across every display via a
 * cached, compiled Swift helper. Falls back to audible beeps when the Swift
 * toolchain is unavailable (e.g. Command Line Tools not installed).
 */
export async function flash(count: number = 3): Promise<FlashMethod> {
  const n = Math.max(1, Math.min(Math.floor(count), 10));
  const bin = await ensureFlashBinary();
  if (bin) {
    try {
      await run(bin, [String(n)], 15_000);
      return "swift";
    } catch {
      /* fall through to the audible fallback */
    }
  }
  await run("osascript", ["-e", `beep ${Math.min(n, 5)}`]);
  return "beep";
}
