import { beforeEach, describe, expect, it, vi } from "vitest";

// `run` is the only subprocess entry point; mock it to capture argv and to
// simulate the Swift toolchain being present or absent.
const run = vi.fn(async () => ({ stdout: "", stderr: "" }));
vi.mock("../src/proc.js", () => ({ run }));

// Control the filesystem checks `flash` makes about the Swift source/binary.
let srcExists = true;
let binExists = true;
let srcMtime = 100;
let binMtime = 200;
const isSwiftSource = (p: string): boolean => p.endsWith(".swift");
const existsSync = vi.fn((p: string) => (isSwiftSource(p) ? srcExists : binExists));
const statSync = vi.fn((p: string) => ({ mtimeMs: isSwiftSource(p) ? srcMtime : binMtime }));
const mkdirSync = vi.fn();
vi.mock("node:fs", () => ({ existsSync, statSync, mkdirSync }));

const { notify, flash, warmFlash } = await import("../src/notify.js");

beforeEach(() => {
  vi.clearAllMocks();
  run.mockResolvedValue({ stdout: "", stderr: "" });
  srcExists = true;
  binExists = true;
  srcMtime = 100;
  binMtime = 200;
});

describe("notify", () => {
  it("passes message/title/subtitle/sound to osascript as argv (never interpolated)", async () => {
    await notify({ message: "body", title: "T", subtitle: "S", sound: "Glass" });
    expect(run).toHaveBeenCalledTimes(1);
    const [file, args] = run.mock.calls[0]!;
    expect(file).toBe("osascript");
    expect(args.slice(2)).toEqual(["body", "T", "S", "Glass"]);
  });

  it("defaults title to Claude and subtitle/sound to empty strings", async () => {
    await notify({ message: "hi" });
    const [, args] = run.mock.calls[0]!;
    expect(args.slice(2)).toEqual(["hi", "Claude", "", ""]);
  });

  it("keeps user text as a discrete arg even when it looks like a shell command", async () => {
    await notify({ message: '"; rm -rf / #' });
    const [, args] = run.mock.calls[0]!;
    expect(args[2]).toBe('"; rm -rf / #');
  });
});

describe("flash", () => {
  it("runs the cached Swift binary when it is up to date", async () => {
    binExists = true;
    binMtime = 999; // newer than source → no recompile
    const method = await flash(3);
    expect(method).toBe("swift");
    const calls = run.mock.calls;
    expect(calls.some(([file]) => file === "swiftc")).toBe(false);
    const flashCall = calls.find(([file]) => String(file).endsWith("/flash"));
    expect(flashCall?.[1]).toEqual(["3"]);
    expect(mkdirSync).not.toHaveBeenCalled();
  });

  it("compiles the Swift helper when the binary is missing", async () => {
    binExists = false;
    const method = await flash(2);
    expect(method).toBe("swift");
    expect(mkdirSync).toHaveBeenCalled();
    const [first] = run.mock.calls;
    expect(first?.[0]).toBe("swiftc");
    expect(run.mock.calls.some(([file]) => String(file).endsWith("/flash"))).toBe(true);
  });

  it("falls back to beeps when the Swift source is unavailable", async () => {
    srcExists = false;
    const method = await flash(3);
    expect(method).toBe("beep");
    expect(run).toHaveBeenCalledTimes(1);
    expect(run.mock.calls[0]).toEqual(["osascript", ["-e", "beep 3"]]);
  });

  it("falls back to beeps when compilation fails", async () => {
    binExists = false;
    run.mockImplementation(async (file: string) => {
      if (file === "swiftc") throw new Error("no swiftc");
      return { stdout: "", stderr: "" };
    });
    expect(await flash(1)).toBe("beep");
    expect(run.mock.calls.some(([file]) => file === "osascript")).toBe(true);
  });

  it("falls back to beeps when running the binary fails", async () => {
    run.mockImplementation(async (file: string) => {
      if (String(file).endsWith("/flash")) throw new Error("flash crashed");
      return { stdout: "", stderr: "" };
    });
    expect(await flash(3)).toBe("beep");
  });

  it("clamps the count and caps the beep fallback at 5", async () => {
    srcExists = false;
    await flash(99);
    expect(run.mock.calls[0]![1]).toEqual(["-e", "beep 5"]);
    run.mockClear();
    await flash(0);
    expect(run.mock.calls[0]![1]).toEqual(["-e", "beep 1"]);
  });
});

describe("warmFlash", () => {
  it("kicks off compilation without throwing", async () => {
    expect(() => warmFlash()).not.toThrow();
    await Promise.resolve();
  });
});
