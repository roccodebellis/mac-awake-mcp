import { describe, expect, it } from "vitest";
import {
  attentionNotification,
  parseHookPayload,
  projectName,
  stopNotification,
} from "../src/hook.js";

describe("parseHookPayload", () => {
  it("parses a JSON object payload", () => {
    expect(parseHookPayload('{"cwd":"/a/b","message":"hi"}')).toEqual({
      cwd: "/a/b",
      message: "hi",
    });
  });

  it("returns {} for empty, whitespace, or invalid input", () => {
    expect(parseHookPayload("")).toEqual({});
    expect(parseHookPayload("   ")).toEqual({});
    expect(parseHookPayload("not json")).toEqual({});
  });

  it("returns {} for non-object JSON (null, number, array)", () => {
    expect(parseHookPayload("null")).toEqual({});
    expect(parseHookPayload("42")).toEqual({});
    // arrays are objects but carry none of our fields — harmless, still typed
    expect(parseHookPayload('"str"')).toEqual({});
  });
});

describe("projectName", () => {
  it("returns the trailing path segment", () => {
    expect(projectName("/Users/x/Repository/P001")).toBe("P001");
  });

  it("ignores trailing slashes", () => {
    expect(projectName("/Users/x/Repository/P001/")).toBe("P001");
  });

  it("returns undefined for missing or root-only paths", () => {
    expect(projectName(undefined)).toBeUndefined();
    expect(projectName("")).toBeUndefined();
    expect(projectName("/")).toBeUndefined();
  });
});

describe("stopNotification", () => {
  it("names the project in the title and sounds Glass", () => {
    const n = stopNotification({ cwd: "/Users/x/Repository/P001" });
    expect(n.title).toBe("Claude · P001");
    expect(n.message).toBe("Finished.");
    expect(n.sound).toBe("Glass");
  });

  it("falls back to a bare Claude title without a cwd", () => {
    expect(stopNotification({}).title).toBe("Claude");
  });

  it("labels a subagent in the subtitle", () => {
    expect(stopNotification({ agent_type: "Explore" }).subtitle).toBe("subagent: Explore");
  });
});

describe("attentionNotification", () => {
  it("carries Claude's own message and the project", () => {
    const n = attentionNotification({
      cwd: "/Users/x/Repository/P001",
      message: "Needs your permission to run Bash",
    });
    expect(n.title).toBe("Claude · P001");
    expect(n.message).toBe("Needs your permission to run Bash");
  });

  it("is silent so it does not stack with the flash / sound hooks", () => {
    expect(attentionNotification({ message: "x" }).sound).toBe("");
  });

  it("defaults the message when none is provided", () => {
    expect(attentionNotification({}).message).toBe("Needs your attention.");
  });

  it("phrases a PermissionDenied event from the tool name", () => {
    const n = attentionNotification({
      cwd: "/Users/x/Repository/P001",
      hook_event_name: "PermissionDenied",
      tool_name: "Bash",
    });
    expect(n.title).toBe("Claude · P001");
    expect(n.message).toBe("Approval needed: Bash");
  });

  it("phrases a permission event without a tool name", () => {
    expect(attentionNotification({ hook_event_name: "PermissionDenied" }).message).toBe(
      "Approval needed.",
    );
  });

  it("prefers an explicit message over the permission fallback", () => {
    const n = attentionNotification({
      hook_event_name: "PermissionDenied",
      tool_name: "Bash",
      message: "Custom text",
    });
    expect(n.message).toBe("Custom text");
  });
});
