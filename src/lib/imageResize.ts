"use client";

// Camera photos commonly come in at several megapixels (3000-4000px on the
// long side). Running OpenCV contour detection, Tesseract OCR, or face
// detection directly on that is slow enough to freeze the tab ("page isn't
// responding") — the heavy CV work blocks the main thread for seconds at a
// time. Downscale once, up front, before any of that runs. 1600px on the
// long side is still comfortably more detail than the page-crop's own output
// target, so this costs nothing in final quality.

export async function downscaleDataUrl(dataUrl: string, maxDim = 1600): Promise<string> {
  const img = await loadImage(dataUrl);
  const { width, height } = img;
  if (Math.max(width, height) <= maxDim) return dataUrl; // already small enough

  const scale = maxDim / Math.max(width, height);
  const outW = Math.round(width * scale);
  const outH = Math.round(height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl; // fail open — use the original rather than throw
  ctx.drawImage(img, 0, 0, outW, outH);
  return canvas.toDataURL("image/jpeg", 0.9);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not decode photo for resizing."));
    img.src = src;
  });
}

export async function dataUrlToFile(dataUrl: string, filename: string): Promise<File> {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  return new File([blob], filename, { type: blob.type || "image/jpeg" });
}
