import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_BUFFER = 8 * 1024 * 1024;

export interface RunResult {
  readonly stdout: string;
  readonly stderr: string;
}

/** Shape of the error Node throws when `execFile` fails. */
interface NodeExecError extends Error {
  code?: number | string;
  killed?: boolean;
  signal?: NodeJS.Signals | null;
  stdout?: string;
  stderr?: string;
}

/** Error carrying the failing command's stderr and exit code. */
export class CommandError extends Error {
  readonly stderr: string;
  readonly code: number | string | null;

  constructor(message: string, stderr: string, code: number | string | null) {
    super(message);
    this.name = "CommandError";
    this.stderr = stderr;
    this.code = code;
  }
}

/**
 * Runs a binary with `execFile` (never a shell). Dynamic values MUST be passed
 * as separate `args` entries — they are never interpolated into a command line,
 * which keeps user-controlled strings from being interpreted by a shell.
 *
 * @throws {CommandError} on non-zero exit, timeout, or a missing binary.
 */
export async function run(
  file: string,
  args: readonly string[],
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<RunResult> {
  try {
    const { stdout, stderr } = await execFileAsync(file, [...args], {
      timeout: timeoutMs,
      maxBuffer: DEFAULT_MAX_BUFFER,
    });
    return { stdout: stdout.toString(), stderr: stderr.toString() };
  } catch (err) {
    const e = err as NodeExecError;
    const stderr = (e.stderr ?? "").toString();
    if (e.code === "ENOENT") {
      throw new CommandError(
        `Could not find \`${file}\`. mac-awake-mcp only runs on macOS.`,
        stderr,
        "ENOENT",
      );
    }
    if (e.killed === true || e.signal === "SIGTERM") {
      throw new CommandError(
        `\`${file}\` timed out after ${timeoutMs}ms.`,
        stderr,
        "TIMEOUT",
      );
    }
    throw new CommandError(
      `\`${file}\` failed: ${stderr.trim() || e.message}`,
      stderr,
      typeof e.code === "number" ? e.code : (e.code ?? null),
    );
  }
}
