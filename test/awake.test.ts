import { describe, expect, it } from "vitest";
import { caffeinateFlags } from "../src/awake.js";

describe("caffeinateFlags", () => {
  it("presentation keeps the display awake (blocks screensaver + lock)", () => {
    expect(caffeinateFlags("presentation")).toEqual(["-d", "-i"]);
  });

  it("compute keeps the system awake but lets the display sleep", () => {
    const flags = caffeinateFlags("compute");
    expect(flags).toEqual(["-i", "-s", "-m"]);
    expect(flags).not.toContain("-d");
  });
});
