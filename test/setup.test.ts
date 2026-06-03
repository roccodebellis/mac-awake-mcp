import { describe, expect, it } from "vitest";
import { buildHooks } from "../src/setup.js";

describe("buildHooks", () => {
  it("wires the session lifecycle to the bin path", () => {
    const json = JSON.stringify(buildHooks("/opt/mac-awake/index.js", 900));
    expect(json).toContain("/opt/mac-awake/index.js");
    expect(json).toContain("keep-awake --ttl 900");
    expect(json).toContain("on-notification");
    expect(json).toContain("on-stop");
  });

  it("wires PermissionDenied so auto-mode blocks alert the user", () => {
    const hooks = buildHooks("/opt/mac-awake/index.js", 900) as {
      hooks: { PermissionDenied?: { hooks: { command: string }[] }[] };
    };
    const command = hooks.hooks.PermissionDenied?.[0]?.hooks[0]?.command;
    expect(command).toContain("on-notification");
  });

  it("invokes node by absolute path so hooks survive a minimal PATH", () => {
    const json = JSON.stringify(buildHooks("/opt/mac-awake/index.js", 900, "/abs/node"));
    // The command must start with the absolute node path, never bare `node `.
    expect(json).toContain('"/abs/node\\" \\"/opt/mac-awake/index.js\\"');
    expect(json).not.toContain('"node ');
  });

  it("defaults to an absolute node path (process.execPath)", () => {
    const hooks = buildHooks("/opt/mac-awake/index.js", 900) as {
      hooks: { UserPromptSubmit: { hooks: { command: string }[] }[] };
    };
    const command = hooks.hooks.UserPromptSubmit[0]!.hooks[0]!.command;
    // Quoted absolute path (handles spaces), never bare `node `.
    expect(command.startsWith('"/')).toBe(true);
    expect(command.startsWith("node ")).toBe(false);
  });
});
