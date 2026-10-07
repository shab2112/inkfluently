import { describe, it, expect, vi, beforeEach } from "vitest";

describe("faceGate console patch", () => {
  beforeEach(() => {
    // The patch guards itself with a window flag to avoid double-patching —
    // reset it and re-import fresh each test so the patch actually reapplies.
    vi.resetModules();
    delete window.__faceGateConsolePatched;
  });

  it("filters the known-benign MediaPipe XNNPACK init message", async () => {
    const spy = vi.fn();
    console.error = spy;

    await import("./faceGate");

    console.error("INFO: Created TensorFlow Lite XNNPACK delegate for CPU.");

    expect(spy).not.toHaveBeenCalled();
  });

  it("still passes through unrelated console.error calls", async () => {
    const spy = vi.fn();
    console.error = spy;

    await import("./faceGate");

    console.error("Some real error that should still show up");

    expect(spy).toHaveBeenCalledWith("Some real error that should still show up");
  });
});
