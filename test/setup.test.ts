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
});
