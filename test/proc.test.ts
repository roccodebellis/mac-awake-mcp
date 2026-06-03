import { describe, expect, it } from "vitest";
import { CommandError, run } from "../src/proc.js";

// Uses the running node binary as a portable, deterministic subprocess so these
// tests pass on any OS/CI without depending on macOS-only tools.
const node = process.execPath;

describe("run", () => {
  it("returns stdout/stderr on success", async () => {
    const { stdout } = await run(node, ["-e", "process.stdout.write('hello')"]);
    expect(stdout).toBe("hello");
  });

  it("throws CommandError with the exit code on non-zero exit", async () => {
    await expect(
      run(node, ["-e", "process.stderr.write('boom');process.exit(3)"]),
    ).rejects.toMatchObject({
      name: "CommandError",
      code: 3,
    });
  });

  it("surfaces stderr text in the CommandError", async () => {
    try {
      await run(node, ["-e", "process.stderr.write('boom');process.exit(1)"]);
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(CommandError);
      expect((err as CommandError).stderr).toContain("boom");
    }
  });

  it("maps a missing binary to code ENOENT", async () => {
    await expect(run("definitely-not-a-real-binary-xyz", [])).rejects.toMatchObject({
      name: "CommandError",
      code: "ENOENT",
    });
  });

  it("maps a timeout to code TIMEOUT", async () => {
    await expect(run(node, ["-e", "setTimeout(() => {}, 10000)"], 150)).rejects.toMatchObject({
      name: "CommandError",
      code: "TIMEOUT",
    });
  });
});
