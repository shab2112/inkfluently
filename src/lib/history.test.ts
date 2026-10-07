import { describe, it, expect } from "vitest";
import { computeWpm } from "./history";

describe("computeWpm", () => {
  it("returns null for durations under 5 seconds (not enough data)", () => {
    expect(computeWpm(10, 3)).toBeNull();
  });

  it("computes a normal, plausible speed", () => {
    // 65 words over 6:32 (392s) ≈ 10 wpm — matches a real observed session.
    expect(computeWpm(65, 392)).toBe(10);
  });

  // A real session displayed 309 wpm — physically impossible for
  // handwriting — traced to the practice timer resetting mid-session
  // (dev-mode hot-reloading, not expected in production either way).
  // Rather than trust an impossible number, treat it the same as "not
  // enough data" instead of displaying it as a real result.
  it("rejects an implausibly high speed instead of displaying it as real", () => {
    expect(computeWpm(65, 13)).toBeNull(); // ≈ 300 wpm
  });

  it("accepts a fast but physically plausible speed", () => {
    expect(computeWpm(100, 60)).toBe(100); // 100 wpm — fast, but under the ceiling
  });
});
