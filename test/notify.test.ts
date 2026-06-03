import { beforeEach, describe, expect, it, vi } from "vitest";

const run = vi.fn(async () => ({ stdout: "", stderr: "" }));
vi.mock("../src/proc.js", () => ({ run }));

const { notify } = await import("../src/notify.js");

describe("notify", () => {
  beforeEach(() => run.mockClear());

  it("passes message/title/subtitle/sound to osascript as argv (never interpolated)", async () => {
    await notify({
      message: "body",
      title: "T",
      subtitle: "S",
      sound: "Glass",
    });
    expect(run).toHaveBeenCalledTimes(1);
    const [file, args] = run.mock.calls[0]!;
    expect(file).toBe("osascript");
    // [ "-e", <script>, message, title, subtitle, sound ]
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
