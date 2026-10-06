"use client";

// On-device face/person-presence gate (docs/spec.md §6.2): separate from the
// OCR check — a photo can contain the right dictated text AND a face in frame
// (reflection, someone walking by). This is a hard block when a face is
// detected, no override, since it's a stronger privacy concern than a
// text-match miss. A technical failure to even run the check (model/WASM
// fetch failed) is NOT treated as "face detected" — it's inconclusive, same
// as the OCR gate's failure mode (spec: best-effort filters, not a guarantee).

import type { FaceDetector } from "@mediapipe/tasks-vision";

let detectorPromise: Promise<FaceDetector> | null = null;

/**
 * Kicks off the MediaPipe WASM + model download early (same reasoning as
 * src/lib/pageCrop.ts's prewarmPageCropLibs — do the one-time network/init
 * cost while the user is still taking their photo, not at Save time).
 */
export function prewarmFaceDetector(): void {
  getDetector().catch(() => {});
}

function getDetector(): Promise<FaceDetector> {
  if (!detectorPromise) {
    detectorPromise = (async () => {
      const { FaceDetector, FilesetResolver } = await import("@mediapipe/tasks-vision");
      const filesetResolver = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
      );
      return FaceDetector.createFromOptions(filesetResolver, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite",
        },
        runningMode: "IMAGE",
      });
    })();
  }
  return detectorPromise;
}

export type FaceGateResult = {
  status: "clear" | "face_detected" | "check_failed";
  faceCount: number;
  reason?: string;
};

export async function runFaceCheck(photoDataUrl: string): Promise<FaceGateResult> {
  try {
    // Same reasoning as pageCrop.ts's extractPageFromPhoto: don't let a slow
    // first-time model/WASM load (if prewarmFaceDetector() hasn't finished)
    // hang this photo — it keeps loading in the background regardless.
    const detector = await Promise.race([
      getDetector(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 20000)),
    ]);
    if (!detector) return { status: "check_failed", faceCount: 0, reason: "Face-detection model took too long to load (20s)." };
    const img = await loadImage(photoDataUrl);
    const result = detector.detect(img);
    const faceCount = result.detections.length;
    return { status: faceCount > 0 ? "face_detected" : "clear", faceCount };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    console.error("Face-detection check failed:", err);
    return { status: "check_failed", faceCount: 0, reason };
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not decode photo for face check."));
    img.src = src;
  });
}
