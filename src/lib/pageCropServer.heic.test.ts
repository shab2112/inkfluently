import { describe, it, expect, vi } from "vitest";

// Scoped to its own file (vi.mock is module-wide) since the rest of
// pageCropServer's tests need real sharp behavior against real generated
// images. This test instead verifies one specific branch deterministically:
// sharp can read an HEIC file's container metadata (reporting
// compression: "hevc") without being able to decode its pixels — verified
// directly against a real downloaded HEIC sample during development (sharp's
// prebuilt binaries never bundle HEVC decoding — patent-encumbered codec,
// confirmed via sharp's own docs). That real file isn't committed here since
// it's a third-party test fixture whose actual visual content can't be
// verified (the same codec gap that's the whole point of this test also
// blocks generating a preview of it) — mocking the one relevant metadata
// field instead keeps this test fully self-contained and verifiable.
vi.mock("sharp", () => {
  const chain = {
    rotate: () => chain,
    clone: () => chain,
    metadata: async () => ({ compression: "hevc", width: 1596, height: 1064 }),
  };
  return { default: () => chain };
});

import { cropToPage } from "./pageCropServer";

describe("cropToPage HEIC handling", () => {
  it("gives an accurate, actionable message for HEIC/HEVC photos instead of the raw libvips codec error", async () => {
    const result = await cropToPage(Buffer.from("not a real file, metadata() is mocked above"));

    expect(result.status).toBe("unavailable");
    if (result.status !== "unavailable") return;
    expect(result.reason).toMatch(/HEIC/i);
    expect(result.reason).toMatch(/Settings.*Camera.*Formats/i);
    // The raw underlying error ("Support for this compression format has
    // not been built in: HEVC") must never reach the user directly — it
    // reads like a page-detection failure, and retaking the photo wouldn't
    // fix a format problem.
    expect(result.reason).not.toMatch(/libvips|libde265|plugin/i);
  });
});
