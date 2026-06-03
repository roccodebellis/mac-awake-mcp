import { beforeEach, describe, expect, it, vi } from "vitest";
import { CommandError } from "../src/proc.js";

// Capture the tools createServer registers by faking the MCP server, then drive
// each tool's handler directly to exercise ok()/fail()/guard() and the wiring.
interface Registered {
  name: string;
  handler: (
    args: Record<string, unknown>,
  ) => Promise<{ content: { text: string }[]; isError?: boolean }>;
}
const registered: Registered[] = [];
class FakeMcpServer {
  constructor(public info: unknown) {}
  registerTool(name: string, _def: unknown, handler: Registered["handler"]): void {
    registered.push({ name, handler });
  }
}
vi.mock("@modelcontextprotocol/sdk/server/mcp.js", () => ({ McpServer: FakeMcpServer }));

const startAwake = vi.fn();
const stopAwake = vi.fn();
const liveState = vi.fn();
const status = vi.fn();
vi.mock("../src/awake.js", () => ({ startAwake, stopAwake, liveState, status }));

const notify = vi.fn(async () => undefined);
const flash = vi.fn(async () => "swift");
vi.mock("../src/notify.js", () => ({ notify, flash }));

const { createServer } = await import("../src/server.js");

const INACTIVE = { active: false, pid: null, mode: null, since: null, ttlSeconds: null };

function tool(name: string): Registered {
  const found = registered.find((r) => r.name === name);
  if (!found) throw new Error(`tool not registered: ${name}`);
  return found;
}
async function call(name: string, args: Record<string, unknown> = {}) {
  return tool(name).handler(args);
}
function body(result: { content: { text: string }[] }): string {
  return result.content[0]!.text;
}

beforeEach(() => {
  registered.length = 0;
  vi.clearAllMocks();
  startAwake.mockReturnValue({
    active: true,
    pid: 7,
    mode: "presentation",
    since: "now",
    ttlSeconds: null,
  });
  stopAwake.mockReturnValue({ stopped: true, pid: 7 });
  liveState.mockReturnValue(INACTIVE);
  status.mockResolvedValue({ state: INACTIVE, assertions: "none" });
  notify.mockResolvedValue(undefined);
  flash.mockResolvedValue("swift");
  createServer();
});

describe("createServer", () => {
  it("registers the five tools", () => {
    expect(registered.map((r) => r.name).sort()).toEqual(
      ["awake_status", "flash", "let_sleep", "notify", "stay_awake"].sort(),
    );
  });
});

describe("stay_awake", () => {
  it("starts presentation mode bound to this process, with no TTL by default", async () => {
    const result = await call("stay_awake", { mode: "presentation" });
    expect(startAwake).toHaveBeenCalledWith({
      mode: "presentation",
      ttlSeconds: null,
      watchPid: process.pid,
    });
    expect(body(result)).toMatch(/Display stays on/);
  });

  it("converts durationMinutes to a TTL in seconds and notes compute mode", async () => {
    startAwake.mockReturnValue({
      active: true,
      pid: 7,
      mode: "compute",
      since: "now",
      ttlSeconds: 300,
    });
    const result = await call("stay_awake", { mode: "compute", durationMinutes: 5 });
    expect(startAwake).toHaveBeenCalledWith({
      mode: "compute",
      ttlSeconds: 300,
      watchPid: process.pid,
    });
    expect(body(result)).toMatch(/System stays awake/);
  });

  it("returns an error result (not a throw) when caffeinate fails", async () => {
    startAwake.mockImplementation(() => {
      throw new CommandError("caffeinate boom", "stderr", 1);
    });
    const result = await call("stay_awake", { mode: "presentation" });
    expect(result.isError).toBe(true);
    expect(body(result)).toBe("caffeinate boom");
  });

  it("wraps unexpected (non-CommandError) failures", async () => {
    startAwake.mockImplementation(() => {
      throw new Error("weird");
    });
    const result = await call("stay_awake", { mode: "presentation" });
    expect(result.isError).toBe(true);
    expect(body(result)).toMatch(/^Unexpected error: weird/);
  });
});

describe("let_sleep / awake_status", () => {
  it("let_sleep releases and reports the previous PID", async () => {
    const parsed = JSON.parse(body(await call("let_sleep")));
    expect(stopAwake).toHaveBeenCalled();
    expect(parsed).toMatchObject({ released: true, previousPid: 7 });
  });

  it("awake_status surfaces the pmset assertions snapshot", async () => {
    const parsed = JSON.parse(body(await call("awake_status")));
    expect(status).toHaveBeenCalled();
    expect(parsed.assertions).toBe("none");
  });
});

describe("notify / flash", () => {
  it("notify posts the banner and echoes title + message", async () => {
    const parsed = JSON.parse(body(await call("notify", { message: "hi", title: "T" })));
    expect(notify).toHaveBeenCalledWith({
      message: "hi",
      title: "T",
      subtitle: undefined,
      sound: undefined,
    });
    expect(parsed).toMatchObject({ posted: true, title: "T", message: "hi" });
  });

  it("notify defaults the reported title to Claude", async () => {
    const parsed = JSON.parse(body(await call("notify", { message: "hi" })));
    expect(parsed.title).toBe("Claude");
  });

  it("flash defaults to three flashes and reports the method", async () => {
    const parsed = JSON.parse(body(await call("flash")));
    expect(flash).toHaveBeenCalledWith(3);
    expect(parsed).toMatchObject({ flashed: true, method: "swift" });
  });

  it("flash honours an explicit count", async () => {
    await call("flash", { count: 6 });
    expect(flash).toHaveBeenCalledWith(6);
  });
});
