import { describe, expect, it } from "vitest";
import { flagValue, modeFlag, numberFlag } from "../src/cli.js";

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
