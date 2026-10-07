import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { cropToPage } from "./pageCropServer";

async function makeTestImage(opts: {
  width: number;
  height: number;
  bg: number;
  rect?: { left: number; top: number; width: number; height: number; fill: number };
}): Promise<Buffer> {
  const { width, height, bg, rect } = opts;
  let img = sharp({
    create: { width, height, channels: 3, background: { r: bg, g: bg, b: bg } },
  });
  if (rect) {
    const overlay = await sharp({
      create: { width: rect.width, height: rect.height, channels: 3, background: { r: rect.fill, g: rect.fill, b: rect.fill } },
    })
      .png()
      .toBuffer();
    img = img.composite([{ input: overlay, left: rect.left, top: rect.top }]);
  }
  return img.jpeg().toBuffer();
}

describe("cropToPage", () => {
  it("crops to a bright rectangular page against a dark background", async () => {
    // 800x600 dark desk, a bright "page" roughly centered at 150,100 sized 500x400.
    const buffer = await makeTestImage({
      width: 800,
      height: 600,
      bg: 40,
      rect: { left: 150, top: 100, width: 500, height: 400, fill: 235 },
    });

    const result = await cropToPage(buffer);
    expect(result.status).toBe("cropped");
    if (result.status !== "cropped") return;

    const meta = await sharp(result.buffer).metadata();
    // Analysis runs at a reduced resolution and scales back up, so allow
    // meaningful tolerance rather than expecting pixel-exact bounds.
    expect(meta.width).toBeGreaterThan(400);
    expect(meta.width).toBeLessThan(600);
    expect(meta.height).toBeGreaterThan(300);
    expect(meta.height).toBeLessThan(500);
  });

  it("rejects a photo with no detectable bright page region (uniform color)", async () => {
    const buffer = await makeTestImage({ width: 800, height: 600, bg: 120 });
    const result = await cropToPage(buffer);
    expect(result.status).toBe("unavailable");
  });

  it("rejects when the bright region covers almost the entire frame (not a real crop)", async () => {
    // Bright region fills all but a thin 10px border — area ratio ~0.96, over MAX_AREA_RATIO.
    const buffer = await makeTestImage({
      width: 800,
      height: 600,
      bg: 30,
      rect: { left: 10, top: 10, width: 780, height: 580, fill: 230 },
    });
    const result = await cropToPage(buffer);
    expect(result.status).toBe("unavailable");
  });

  it("rejects when the bright region is implausibly small", async () => {
    const buffer = await makeTestImage({
      width: 800,
      height: 600,
      bg: 40,
      rect: { left: 380, top: 280, width: 40, height: 40, fill: 230 },
    });
    const result = await cropToPage(buffer);
    expect(result.status).toBe("unavailable");
  });

  // Regression test: sharp's metadata() always reports the RAW stored
  // width/height, never the post-rotation dimensions — it does not account
  // for the pending .rotate() call. EXIF orientations 5-8 involve a 90°/270°
  // turn, which swaps which dimension becomes width vs height once rotation
  // is actually applied. Using the raw values directly (the original bug)
  // computed the crop's analysis scale and extract region against the wrong
  // dimensions, crashing sharp's .extract() with "bad extract area" — this
  // affects any photo taken with the phone held in landscape, not a rare
  // edge case. Verified directly against a real photo before this test
  // existed; reproduced here with a synthetic image so it's committable.
  it("crops correctly when EXIF orientation requires a 90°/270° rotation (landscape-held photo)", async () => {
    // A 800x600 "landscape" source that, once rotated 90° upright, becomes
    // 600x800 "portrait" with the bright page region centered within it.
    const landscapeBuffer = await makeTestImage({
      width: 800,
      height: 600,
      bg: 40,
      rect: { left: 50, top: 150, width: 500, height: 400, fill: 235 },
    });
    const stored = await sharp(landscapeBuffer).withMetadata({ orientation: 6 }).jpeg().toBuffer();
    const storedMeta = await sharp(stored).metadata();
    expect(storedMeta.width).toBe(800); // confirms the raw/stored dims are still landscape
    expect(storedMeta.orientation).toBe(6);

    const result = await cropToPage(stored);
    expect(result.status).toBe("cropped");
    if (result.status !== "cropped") return;

    const meta = await sharp(result.buffer).metadata();
    // Post-rotation the image is portrait (600 wide x 800 tall); the crop
    // output must respect that, not the raw landscape dimensions.
    expect(meta.width).toBeLessThan(meta.height!);
  });
});
