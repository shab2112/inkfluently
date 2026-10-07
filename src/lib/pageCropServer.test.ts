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
});
