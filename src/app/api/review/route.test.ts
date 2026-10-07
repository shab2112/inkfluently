// @vitest-environment node
// This route handler has no DOM dependency, and jsdom's FormData/File globals
// don't interoperate reliably with Next's own Request.formData() parsing —
// run this file under plain Node instead (matches where it actually runs).
import { describe, it, expect, vi } from "vitest";
import sharp from "sharp";
import type { NextRequest } from "next/server";

// The AI call itself is out of scope here (covered by src/lib/gemini.test.ts)
// — this test is specifically about the page-crop enforcement added to this
// route: a request that can't be confirmed as "just the page" must never
// reach reviewHandwritingPhoto at all, regardless of how it was sent.
vi.mock("@/lib/gemini", () => ({
  reviewHandwritingPhoto: vi.fn(async () => ({
    legibility: { score: 4, feedback: "ok", dimensions: [] },
    accuracy: null,
  })),
  GeminiReviewError: class GeminiReviewError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  },
}));

import { POST } from "./route";
import { reviewHandwritingPhoto } from "@/lib/gemini";

async function makeTestImage(opts: {
  width: number;
  height: number;
  bg: number;
  rect?: { left: number; top: number; width: number; height: number; fill: number };
}): Promise<Buffer> {
  const { width, height, bg, rect } = opts;
  let img = sharp({ create: { width, height, channels: 3, background: { r: bg, g: bg, b: bg } } });
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

function makeRequest(buffer: Buffer, passageText = "hello world"): NextRequest {
  const form = new FormData();
  form.append("photo", new File([new Uint8Array(buffer)], "photo.jpg", { type: "image/jpeg" }));
  form.append("passageText", passageText);
  return new Request("http://localhost/api/review", { method: "POST", body: form }) as unknown as NextRequest;
}

describe("/api/review page-crop enforcement", () => {
  it("rejects with 422 page_not_detected when no page is detectable, and never calls the AI", async () => {
    const buffer = await makeTestImage({ width: 800, height: 600, bg: 120 }); // uniform, no page-like region
    const res = await POST(makeRequest(buffer));

    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.code).toBe("page_not_detected");
    expect(reviewHandwritingPhoto).not.toHaveBeenCalled();
  });

  it("crops and forwards only the cropped image to the AI when a page is detected", async () => {
    const buffer = await makeTestImage({
      width: 800,
      height: 600,
      bg: 40,
      rect: { left: 150, top: 100, width: 500, height: 400, fill: 235 },
    });
    const res = await POST(makeRequest(buffer));

    expect(res.status).toBe(200);
    expect(reviewHandwritingPhoto).toHaveBeenCalledTimes(1);

    const [sentBase64, sentMimeType] = vi.mocked(reviewHandwritingPhoto).mock.calls[0];
    expect(sentMimeType).toBe("image/jpeg");
    const sentBuffer = Buffer.from(sentBase64, "base64");
    // The cropped image must actually be smaller than the original frame —
    // otherwise "cropping" would be a no-op that still sends the whole photo.
    expect(sentBuffer.length).toBeLessThan(buffer.length);
  });
});
