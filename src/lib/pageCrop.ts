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

declare global {
  interface Window {
    cv?: { Mat?: unknown; onRuntimeInitialized?: () => void };
    jscanify?: new () => {
      extractPaper: (img: HTMLImageElement, width: number, height: number) => HTMLCanvasElement;
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
    await ensureLoaded();
    const img = await loadImage(photoDataUrl);
    if (!window.jscanify) throw new Error("jscanify did not attach to window");
    const scanner = new window.jscanify();

    // Target output: a portrait page shape, sized from the source photo's own
    // resolution so we don't upscale a low-res photo or needlessly downscale a
    // high-res one.
    const outW = Math.min(1400, img.naturalWidth || 1000);
    const outH = Math.round(outW * 1.414); // A4/letter-ish portrait ratio
    const canvas = scanner.extractPaper(img, outW, outH);

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
