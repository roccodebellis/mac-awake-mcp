import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock the OS layer so the keep-awake state machine can be tested deterministically
// on any platform (no real caffeinate / ps / pmset).
const spawn = vi.fn();
const execFileSync = vi.fn();
vi.mock("node:child_process", () => ({ spawn, execFileSync }));

// A tiny in-memory stand-in for the on-disk state file.
let fileContent: string | null = null;
const existsSync = vi.fn(() => fileContent !== null);
const readFileSync = vi.fn(() => {
  if (fileContent === null) throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
  return fileContent;
});
const writeFileSync = vi.fn((_path: string, data: string) => {
  fileContent = data;
});
const mkdirSync = vi.fn();
const rmSync = vi.fn(() => {
  fileContent = null;
});
vi.mock("node:fs", () => ({ existsSync, readFileSync, writeFileSync, mkdirSync, rmSync }));

const run = vi.fn(async () => ({ stdout: "", stderr: "" }));
vi.mock("../src/proc.js", () => ({ run }));

const awake = await import("../src/awake.js");

/** Serialize a state object the way writeState would, to seed the fake file. */
function seed(state: Record<string, unknown>): void {
  fileContent = JSON.stringify(state, null, 2);
}

const ALIVE_PRESENTATION = {
  active: true,
  pid: 4242,
  mode: "presentation",
  since: new Date().toISOString(),
  ttlSeconds: 900,
};

beforeEach(() => {
  vi.clearAllMocks();
  fileContent = null;
  spawn.mockReturnValue({ pid: 4242, unref: vi.fn() });
  execFileSync.mockReturnValue("caffeinate\n");
  vi.spyOn(process, "kill").mockReturnValue(true);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("caffeinateFlags", () => {
  it("presentation keeps the display awake (blocks screensaver + lock)", () => {
    expect(awake.caffeinateFlags("presentation")).toEqual(["-d", "-i"]);
  });

  it("compute keeps the system awake but lets the display sleep", () => {
    const flags = awake.caffeinateFlags("compute");
    expect(flags).toEqual(["-i", "-s", "-m"]);
    expect(flags).not.toContain("-d");
  });
});

describe("liveState", () => {
  it("returns inactive when there is no state file", () => {
    expect(awake.liveState()).toMatchObject({ active: false, pid: null });
  });

  it("reports active when the tracked PID is a live caffeinate", () => {
    seed(ALIVE_PRESENTATION);
    expect(awake.liveState()).toMatchObject({ active: true, pid: 4242, mode: "presentation" });
  });

  it("clears stale state when the PID is dead", () => {
    seed(ALIVE_PRESENTATION);
    vi.spyOn(process, "kill").mockImplementation(() => {
      throw Object.assign(new Error("no such process"), { code: "ESRCH" });
    });
    expect(awake.liveState().active).toBe(false);
    expect(rmSync).toHaveBeenCalled();
  });

  it("treats EPERM from kill(0) as alive (process exists, not ours to signal)", () => {
    seed(ALIVE_PRESENTATION);
    vi.spyOn(process, "kill").mockImplementation(() => {
      throw Object.assign(new Error("operation not permitted"), { code: "EPERM" });
    });
    expect(awake.liveState().active).toBe(true);
  });

  it("ignores a live PID that is not a caffeinate (PID reuse)", () => {
    seed(ALIVE_PRESENTATION);
    execFileSync.mockReturnValue("node\n");
    expect(awake.liveState().active).toBe(false);
  });

  it("treats a failing ps lookup as not-ours", () => {
    seed(ALIVE_PRESENTATION);
    execFileSync.mockImplementation(() => {
      throw new Error("ps failed");
    });
    expect(awake.liveState().active).toBe(false);
  });

  it("returns inactive when the state file is corrupt", () => {
    fileContent = "}{ not json";
    expect(awake.liveState().active).toBe(false);
  });
});

describe("startAwake", () => {
  it("spawns presentation caffeinate with watch PID and TTL", () => {
    const state = awake.startAwake({ mode: "presentation", watchPid: 99, ttlSeconds: 120 });
    expect(spawn).toHaveBeenCalledWith(
      "caffeinate",
      ["-d", "-i", "-w", "99", "-t", "120"],
      expect.objectContaining({ detached: true, stdio: "ignore" }),
    );
    expect(state).toMatchObject({ active: true, pid: 4242, mode: "presentation", ttlSeconds: 120 });
    expect(writeFileSync).toHaveBeenCalled();
  });

  it("spawns compute caffeinate without watch/TTL when omitted", () => {
    awake.startAwake({ mode: "compute" });
    expect(spawn).toHaveBeenCalledWith("caffeinate", ["-i", "-s", "-m"], expect.anything());
  });

  it("defaults to presentation mode", () => {
    expect(awake.startAwake().mode).toBe("presentation");
  });

  it("throws when caffeinate yields no PID", () => {
    spawn.mockReturnValue({ pid: undefined, unref: vi.fn() });
    expect(() => awake.startAwake()).toThrow(/Failed to launch caffeinate/);
  });
});

describe("keepAwakeRefresh", () => {
  it("does not respawn within the debounce window for the same mode", () => {
    seed(ALIVE_PRESENTATION);
    const state = awake.keepAwakeRefresh("presentation", 900);
    expect(spawn).not.toHaveBeenCalled();
    expect(state.pid).toBe(4242);
  });

  it("respawns when the existing assertion is stale", () => {
    seed({ ...ALIVE_PRESENTATION, since: "2000-01-01T00:00:00.000Z" });
    awake.keepAwakeRefresh("presentation", 900);
    expect(spawn).toHaveBeenCalled();
  });

  it("respawns when the requested mode differs", () => {
    seed(ALIVE_PRESENTATION);
    awake.keepAwakeRefresh("compute", 900);
    expect(spawn).toHaveBeenCalled();
  });
});

describe("stopAwake", () => {
  it("SIGTERMs a live caffeinate and clears state", () => {
    seed(ALIVE_PRESENTATION);
    const kill = vi.spyOn(process, "kill").mockReturnValue(true);
    const result = awake.stopAwake();
    expect(kill).toHaveBeenCalledWith(4242, "SIGTERM");
    expect(result).toEqual({ stopped: true, pid: 4242 });
    expect(rmSync).toHaveBeenCalled();
  });

  it("is a no-op when nothing is tracked", () => {
    expect(awake.stopAwake()).toEqual({ stopped: false, pid: null });
  });
});

describe("status", () => {
  it("returns only the caffeinate pmset assertion lines", async () => {
    run.mockResolvedValue({
      stdout: "  pid 1: PreventUserIdleDisplaySleep via caffeinate\nother junk\n",
      stderr: "",
    });
    const { assertions } = await awake.status();
    expect(assertions).toContain("caffeinate");
    expect(assertions).not.toContain("other junk");
  });

  it("reports when no caffeinate assertion is present", async () => {
    run.mockResolvedValue({ stdout: "nothing relevant here\n", stderr: "" });
    expect((await awake.status()).assertions).toMatch(/no caffeinate assertion/);
  });

  it("falls back to a friendly message when pmset cannot be read", async () => {
    run.mockRejectedValue(new Error("pmset missing"));
    expect((await awake.status()).assertions).toMatch(/could not read/);
  });
});
