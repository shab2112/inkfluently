"use client";

// Client-side document/page detection + crop (docs/spec.md §6, data-minimization
// addition): before a photo is sent anywhere — the safety gates or the AI review
// — detect the paper's edges and crop+straighten to just that region, so
// whatever's in the background (desk, room, other objects) never leaves the
// device at all. This is a best-effort visual crop, not a security boundary:
// if detection fails or looks confidently wrong, we fall back to the original
// photo rather than silently shipping a bad crop or blocking the whole flow.
//
// Loaded as browser-only CDN scripts (not an npm dependency): jscanify's npm
// package pulls in a native `canvas` build for Node.js support we don't need,
// which requires Visual Studio build tools on Windows — unnecessary friction
// for a browser-only feature. opencv.js is ~8MB; this is the same "fetch a
// vision model/runtime from a CDN at first use" pattern already used for the
// face-detection gate (src/lib/faceGate.ts).

type CvMat = { delete: () => void; rows: number; cols: number };
type CvContour = { delete: () => void };
type CvRotatedRect = { size: { width: number; height: number } };
type CornerPoints = {
  topLeftCorner: { x: number; y: number };
  topRightCorner: { x: number; y: number };
  bottomLeftCorner: { x: number; y: number };
  bottomRightCorner: { x: number; y: number };
};

declare global {
  interface Window {
    cv?: {
      Mat?: unknown;
      onRuntimeInitialized?: () => void;
      imread: (img: HTMLImageElement) => CvMat;
      contourArea: (contour: CvContour) => number;
      minAreaRect: (contour: CvContour) => CvRotatedRect;
    };
    jscanify?: new () => {
      findPaperContour: (mat: CvMat) => CvContour | null;
      getCornerPoints: (contour: CvContour) => Partial<CornerPoints>;
      extractPaper: (
        img: HTMLImageElement,
        width: number,
        height: number,
        cornerPoints?: CornerPoints
      ) => HTMLCanvasElement | null;
    };
  }
}

const OPENCV_SRC = "https://docs.opencv.org/4.7.0/opencv.js";
const JSCANIFY_SRC = "https://cdn.jsdelivr.net/gh/ColonelParrot/jscanify@master/src/jscanify.min.js";

function loadScript(id: string, src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.getElementById(id) as HTMLScriptElement | null;
    if (existing) {
      if (existing.dataset.loaded === "true") resolve();
      else existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error(`Failed to load ${src}`)), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.id = id;
    script.src = src;
    script.async = true;
    script.onload = () => {
      script.dataset.loaded = "true";
      resolve();
    };
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.body.appendChild(script);
  });
}

let readyPromise: Promise<void> | null = null;

/**
 * Kicks off the opencv.js/jscanify download + WASM init early (e.g. when the
 * Finish screen first mounts), so the one-time ~8MB load/compile cost — which
 * genuinely blocks the main thread long enough to trigger Chrome's "page
 * isn't responding" warning — happens while the user is still taking/picking
 * their photo, not at the exact moment they hit Save. Safe to call multiple
 * times; errors are swallowed since this is just a best-effort warm-up (the
 * real call site still awaits `ensureLoaded()` and handles failure there).
 */
export function prewarmPageCropLibs(): void {
  ensureLoaded().catch(() => {});
}

function ensureLoaded(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("browser only"));
  if (!readyPromise) {
    readyPromise = (async () => {
      await loadScript("opencv-js", OPENCV_SRC);
      await new Promise<void>((resolve, reject) => {
        const cv = window.cv;
        if (!cv) {
          reject(new Error("opencv.js loaded but window.cv is missing"));
          return;
        }
        if (cv.Mat) {
          resolve(); // already initialized
          return;
        }
        cv.onRuntimeInitialized = () => resolve();
      });
      await loadScript("jscanify-js", JSCANIFY_SRC);
    })();
  }
  return readyPromise;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not decode photo for page crop."));
    img.src = src;
  });
}

export type PageCropResult =
  | { status: "cropped"; dataUrl: string }
  | { status: "unavailable"; reason: string };

export async function extractPageFromPhoto(photoDataUrl: string): Promise<PageCropResult> {
  try {
    // Safety net for the case prewarmPageCropLibs() didn't finish in time (slow
    // connection, or the user reached Save unusually fast): don't let a slow
    // library load hang this specific photo — the load keeps running in the
    // background regardless, so the NEXT photo this session will be instant.
    const loaded = await Promise.race([
      ensureLoaded().then(() => true),
      new Promise<false>((resolve) => setTimeout(() => resolve(false), 20000)),
    ]);
    if (!loaded) {
      return { status: "unavailable", reason: "Page-crop tools are still loading — using the full photo this time." };
    }
    const img = await loadImage(photoDataUrl);
    if (!window.jscanify || !window.cv) throw new Error("jscanify/opencv did not attach to window");
    const cv = window.cv;
    const scanner = new window.jscanify();

    // jscanify's extractPaper() just takes the single largest contour by area,
    // with no check that it's actually rectangle-shaped — on a busy/low-contrast
    // background, edge detection can merge the page and the background into one
    // big blob, which it then happily accepts as "the page". Do our own
    // plausibility check on the detected contour before trusting it: reject
    // anything that grabbed almost the whole frame (background bleed), is
    // implausibly small, or isn't close to rectangular (a real page's contour
    // area should nearly fill its own bounding rotated rect; an irregular
    // merged blob won't).
    const mat = cv.imread(img);
    const contour = scanner.findPaperContour(mat);
    if (!contour) {
      mat.delete();
      return { status: "unavailable", reason: "No page edges detected in this photo." };
    }

    const totalArea = mat.rows * mat.cols;
    const contourArea = cv.contourArea(contour);
    const areaRatio = totalArea > 0 ? contourArea / totalArea : 0;
    const rotatedRect = cv.minAreaRect(contour);
    const rectArea = rotatedRect.size.width * rotatedRect.size.height;
    const extent = rectArea > 0 ? contourArea / rectArea : 0;

    const plausible = areaRatio >= 0.08 && areaRatio <= 0.93 && extent >= 0.75;
    if (!plausible) {
      contour.delete();
      mat.delete();
      return {
        status: "unavailable",
        reason: `Detected boundary didn't look like a real page (area ratio ${areaRatio.toFixed(2)}, extent ${extent.toFixed(2)}).`,
      };
    }

    const corners = scanner.getCornerPoints(contour);
    contour.delete();
    mat.delete();
    if (!corners.topLeftCorner || !corners.topRightCorner || !corners.bottomLeftCorner || !corners.bottomRightCorner) {
      return { status: "unavailable", reason: "Could not resolve all four page corners." };
    }

    // Target output: a portrait page shape, sized from the source photo's own
    // resolution so we don't upscale a low-res photo or needlessly downscale a
    // high-res one.
    const outW = Math.min(1400, img.naturalWidth || 1000);
    const outH = Math.round(outW * 1.414); // A4/letter-ish portrait ratio
    const canvas = scanner.extractPaper(img, outW, outH, corners as CornerPoints);

    if (!canvas || canvas.width < 20 || canvas.height < 20) {
      return { status: "unavailable", reason: "Detected crop was too small to be a real page." };
    }
    return { status: "cropped", dataUrl: canvas.toDataURL("image/jpeg", 0.92) };
  } catch (err) {
    console.error("Page crop failed:", err);
    return { status: "unavailable", reason: err instanceof Error ? err.message : "unknown" };
  }
}

export async function dataUrlToFile(dataUrl: string, filename: string): Promise<File> {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  return new File([blob], filename, { type: blob.type || "image/jpeg" });
}
