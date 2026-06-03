import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock every collaborator so dispatch can be tested without touching macOS,
// stdin, or a real MCP transport.
const keepAwakeRefresh = vi.fn();
const stopAwake = vi.fn();
const liveState = vi.fn();
const status = vi.fn();
vi.mock("../src/awake.js", () => ({ keepAwakeRefresh, stopAwake, liveState, status }));

const attentionNotification = vi.fn(() => ({ message: "attention" }));
const stopNotification = vi.fn(() => ({ message: "done" }));
const parseHookPayload = vi.fn(() => ({}));
vi.mock("../src/hook.js", () => ({ attentionNotification, stopNotification, parseHookPayload }));

const notify = vi.fn(async () => undefined);
const flash = vi.fn(async () => "swift");
const warmFlash = vi.fn();
vi.mock("../src/notify.js", () => ({ notify, flash, warmFlash }));

const serverConnect = vi.fn(async () => undefined);
const createServer = vi.fn(() => ({ connect: serverConnect }));
vi.mock("../src/server.js", () => ({
  createServer,
  SERVER_NAME: "mac-awake-mcp",
  SERVER_VERSION: "0.1.0",
}));

const setupText = vi.fn(() => "SETUP TEXT");
vi.mock("../src/setup.js", () => ({ setupText }));

vi.mock("@modelcontextprotocol/sdk/server/stdio.js", () => ({
  StdioServerTransport: class {},
}));

const { runCli, flagValue, numberFlag, modeFlag } = await import("../src/cli.js");

describe("flagValue", () => {
  it("reads `--flag value` form", () => {
    expect(flagValue(["--ttl", "900"], "--ttl")).toBe("900");
  });
  it("reads `--flag=value` form", () => {
    expect(flagValue(["--ttl=900"], "--ttl")).toBe("900");
  });
  it("returns undefined when absent", () => {
    expect(flagValue(["--mode", "compute"], "--ttl")).toBeUndefined();
  });
});

describe("numberFlag", () => {
  it("parses a numeric value", () => {
    expect(numberFlag(["--ttl", "1200"], "--ttl", 900)).toBe(1200);
  });
  it("falls back when missing or non-numeric", () => {
    expect(numberFlag([], "--ttl", 900)).toBe(900);
    expect(numberFlag(["--ttl", "abc"], "--ttl", 900)).toBe(900);
  });
});

describe("modeFlag", () => {
  it("returns compute only when explicitly set", () => {
    expect(modeFlag(["--mode", "compute"])).toBe("compute");
  });
  it("defaults to presentation", () => {
    expect(modeFlag([])).toBe("presentation");
    expect(modeFlag(["--mode", "anything-else"])).toBe("presentation");
  });
});

describe("runCli dispatch", () => {
  let stdoutWrite: ReturnType<typeof vi.spyOn>;
  let stderrWrite: ReturnType<typeof vi.spyOn>;
  let consoleError: ReturnType<typeof vi.spyOn>;
  const origStdin = process.stdin;
  const origIsTTY = process.stdin.isTTY;
  const origExitCode = process.exitCode;

  beforeEach(() => {
    vi.clearAllMocks();
    liveState.mockReturnValue({ active: false });
    status.mockResolvedValue({ state: { active: false }, assertions: "none" });
    createServer.mockReturnValue({ connect: serverConnect });
    // A TTY makes readStdin return "" immediately, so hook commands don't block.
    Object.defineProperty(process.stdin, "isTTY", { value: true, configurable: true });
    stdoutWrite = vi.spyOn(process.stdout, "write").mockReturnValue(true);
    stderrWrite = vi.spyOn(process.stderr, "write").mockReturnValue(true);
    consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(process, "stdin", { value: origStdin, configurable: true });
    Object.defineProperty(process.stdin, "isTTY", { value: origIsTTY, configurable: true });
    process.exitCode = origExitCode;
  });

  it("keep-awake refreshes with the parsed mode and ttl", async () => {
    await runCli(["keep-awake", "--ttl", "100", "--mode", "compute"]);
    expect(keepAwakeRefresh).toHaveBeenCalledWith("compute", 100);
  });

  it("release stops the assertion", async () => {
    await runCli(["release"]);
    expect(stopAwake).toHaveBeenCalled();
  });

  it("on-notification notifies, flashes, then releases", async () => {
    await runCli(["on-notification"]);
    expect(parseHookPayload).toHaveBeenCalled();
    expect(notify).toHaveBeenCalledWith({ message: "attention" });
    expect(flash).toHaveBeenCalledWith(3);
    expect(stopAwake).toHaveBeenCalled();
  });

  it("on-stop announces 'finished' only when it was keeping awake", async () => {
    liveState.mockReturnValue({ active: true });
    await runCli(["on-stop"]);
    expect(notify).toHaveBeenCalledWith({ message: "done" });
    expect(stopAwake).toHaveBeenCalled();
  });

  it("on-stop stays silent when nothing was active", async () => {
    liveState.mockReturnValue({ active: false });
    await runCli(["on-stop"]);
    expect(notify).not.toHaveBeenCalled();
    expect(stopAwake).toHaveBeenCalled();
  });

  it("flash honours --count", async () => {
    await runCli(["flash", "--count", "5"]);
    expect(flash).toHaveBeenCalledWith(5);
  });

  it("notify passes an explicit --message", async () => {
    await runCli(["notify", "--message", "hello"]);
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ message: "hello" }));
  });

  it("notify falls back to a default message", async () => {
    await runCli(["notify"]);
    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Claude needs your attention." }),
    );
  });

  it("status writes the JSON snapshot to stdout", async () => {
    await runCli(["status"]);
    const out = stdoutWrite.mock.calls.map((c) => String(c[0])).join("");
    expect(out).toContain("assertions");
  });

  it("setup prints the setup text", async () => {
    await runCli(["setup"]);
    expect(stdoutWrite).toHaveBeenCalledWith(expect.stringContaining("SETUP TEXT"));
  });

  it("help prints usage", async () => {
    await runCli(["help"]);
    const out = stdoutWrite.mock.calls.map((c) => String(c[0])).join("");
    expect(out).toContain("Usage:");
  });

  it("serve (default) connects the MCP server over stdio", async () => {
    await runCli([]);
    expect(warmFlash).toHaveBeenCalled();
    expect(createServer).toHaveBeenCalled();
    expect(serverConnect).toHaveBeenCalled();
  });

  it("an unknown command prints usage and sets exit code 2", async () => {
    await runCli(["bogus"]);
    expect(stderrWrite).toHaveBeenCalled();
    expect(process.exitCode).toBe(2);
  });

  it("swallows and logs a failing subcommand so the hook never breaks the session", async () => {
    keepAwakeRefresh.mockImplementationOnce(() => {
      throw new Error("caffeinate exploded");
    });
    await expect(runCli(["keep-awake"])).resolves.toBeUndefined();
    expect(consoleError).toHaveBeenCalled();
  });

  it("reads a hook payload piped on stdin when not a TTY", async () => {
    // A fake stdin lets us drive the readStdin() data/end path deterministically.
    const fake = new EventEmitter() as EventEmitter & {
      isTTY?: boolean;
      setEncoding: () => void;
      pause: () => void;
    };
    fake.isTTY = false;
    fake.setEncoding = () => undefined;
    fake.pause = () => undefined;
    Object.defineProperty(process, "stdin", { value: fake, configurable: true });

    const payload = '{"hook_event_name":"Notification","cwd":"/x"}';
    const promise = runCli(["on-notification"]);
    fake.emit("data", payload);
    fake.emit("end");
    await promise;

    expect(parseHookPayload).toHaveBeenCalledWith(payload);
    expect(notify).toHaveBeenCalled();
  });
});
