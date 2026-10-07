import sharp from "sharp";

// Server-only page-crop (docs/spec.md §6, data-minimization): detect the
// paper's bounding box and crop to it before anything is forwarded to the AI
// service. This replaces an earlier client-side opencv.js/jscanify version —
// that ran in the browser only, so the server had no way to enforce it (a
// request sent directly to this API, bypassing the browser entirely, skipped
// cropping completely). Running this here instead means EVERY request that
// reaches the AI call goes through the same mandatory check, no matter how
// it was sent.
//
// Algorithm: not full contour/perspective detection like jscanify (no
// dependency that does that is practical to run in a Node serverless
// function without reintroducing native-binding build pain — see the
// deleted pageCrop.ts for why that was avoided client-side too) — instead,
// a simpler, dependency-light heuristic: paper is usually the brightest
// large contiguous region in frame, against a comparatively darker/textured
// background (desk, floor, wall). Find it via brightness-thresholded row/
// column projections, not contour tracing. This won't straighten an angled
// photo (no perspective warp), so a crooked shot keeps a bit of background
// at the corners — a real quality tradeoff against the old approach, but one
// that can run anywhere this code runs, unconditionally.

export type PageCropResult =
  | { status: "cropped"; buffer: Buffer; mimeType: "image/jpeg" }
  | { status: "unavailable"; reason: string };

const ANALYSIS_MAX_DIM = 500;
// A row/column counts as "part of the page" once at least this fraction of
// its pixels are bright — low enough to tolerate a shadow or a pen crossing
// the page, high enough to not count a narrow bright sliver of background.
const LINE_BRIGHT_FRACTION = 0.5;
const MIN_AREA_RATIO = 0.08;
const MAX_AREA_RATIO = 0.93;

export async function cropToPage(inputBuffer: Buffer): Promise<PageCropResult> {
  try {
    const oriented = sharp(inputBuffer).rotate(); // apply EXIF orientation once, up front
    const meta = await oriented.metadata();

    // sharp's prebuilt binaries can read an HEIC file's container/metadata
    // (which is why this isn't caught by the dimension check below) but
    // cannot decode its actual pixels — HEIC's HEVC compression is patent-
    // encumbered, and sharp (and Vercel's serverless Linux build of it) will
    // never bundle that codec. Verified directly: metadata() succeeds, but
    // the exact same decode this function needs next throws "Support for
    // this compression format has not been built in: HEVC". Catch this
    // up front with an accurate message — the raw error otherwise sounds
    // like a page-detection failure, when it's really an unsupported file
    // format, and no amount of retaking the photo would fix it.
    if (meta.compression === "hevc") {
      return {
        status: "unavailable",
        reason:
          "This looks like an HEIC photo (common on iPhone), which can't be processed. On iPhone, go to " +
          "Settings → Camera → Formats and switch to \"Most Compatible\" before retaking, or send a JPEG/PNG instead.",
      };
    }

    // sharp's metadata() always reports the RAW stored width/height — it
    // does not account for the pending .rotate() operation above. EXIF
    // orientations 5-8 involve a 90°/270° turn, which swaps which dimension
    // ends up as width vs height once rotation is actually applied. Using
    // the raw (unswapped) values here was a real bug: any photo with one of
    // these orientations (routine for a phone held in landscape — this is
    // not a rare edge case) produced a scale/extract region computed against
    // the wrong dimensions, crashing the later .extract() call with "bad
    // extract area" — verified directly against a real EXIF-orientation-6
    // test image. Confirmed via sharp's documented behavior, not guessed.
    const swapsDimensions = meta.orientation != null && meta.orientation >= 5 && meta.orientation <= 8;
    const width = swapsDimensions ? meta.height : meta.width;
    const height = swapsDimensions ? meta.width : meta.height;
    if (!width || !height) {
      return { status: "unavailable", reason: "Couldn't read this photo at all — try a different one." };
    }

    const scale = Math.max(width, height) / ANALYSIS_MAX_DIM;
    const analysisWidth = Math.max(1, Math.round(width / scale));
    const analysisHeight = Math.max(1, Math.round(height / scale));

    const { data } = await oriented
      .clone()
      .resize(analysisWidth, analysisHeight, { fit: "fill" })
      .grayscale()
      .raw()
      .toBuffer({ resolveWithObject: true });

    // Threshold relative to this photo's own brightness distribution (the
    // mean of its brightest half), not a fixed value — lighting varies too
    // much photo to photo for one constant to work well across real cameras.
    const sortedBrightness = Uint8Array.from(data).slice().sort((a, b) => a - b);
    const upperHalf = sortedBrightness.subarray(Math.floor(sortedBrightness.length / 2));
    const upperMean = upperHalf.reduce((sum, v) => sum + v, 0) / upperHalf.length;
    const threshold = Math.max(100, upperMean * 0.75);

    const bright = new Uint8Array(analysisWidth * analysisHeight);
    for (let i = 0; i < data.length; i++) bright[i] = data[i] >= threshold ? 1 : 0;

    const rowCounts = new Array(analysisHeight).fill(0);
    const colCounts = new Array(analysisWidth).fill(0);
    for (let y = 0; y < analysisHeight; y++) {
      for (let x = 0; x < analysisWidth; x++) {
        const v = bright[y * analysisWidth + x];
        rowCounts[y] += v;
        colCounts[x] += v;
      }
    }

    const rowThreshold = analysisWidth * LINE_BRIGHT_FRACTION;
    const colThreshold = analysisHeight * LINE_BRIGHT_FRACTION;

    const top = rowCounts.findIndex((c) => c >= rowThreshold);
    const bottom = findLastIndex(rowCounts, (c) => c >= rowThreshold);
    const left = colCounts.findIndex((c) => c >= colThreshold);
    const right = findLastIndex(colCounts, (c) => c >= colThreshold);

    const NO_PAGE_FOUND_MESSAGE =
      "Couldn't find the page in this photo — retake it with brighter, more even lighting and a plain background behind the page.";

    if (top < 0 || bottom < 0 || left < 0 || right < 0 || bottom <= top || right <= left) {
      return { status: "unavailable", reason: NO_PAGE_FOUND_MESSAGE };
    }

    const boxWidth = right - left + 1;
    const boxHeight = bottom - top + 1;
    const areaRatio = (boxWidth * boxHeight) / (analysisWidth * analysisHeight);
    if (areaRatio < MIN_AREA_RATIO || areaRatio > MAX_AREA_RATIO) {
      // Area ratio is an internal diagnostic, not something a parent can act
      // on — log it server-side, keep the user-facing message actionable.
      console.log(`[pageCropServer] rejected: implausible area ratio ${areaRatio.toFixed(2)}`);
      return { status: "unavailable", reason: NO_PAGE_FOUND_MESSAGE };
    }

    // Scale the analysis-resolution box back up to the original image.
    const extractLeft = Math.max(0, Math.round(left * scale));
    const extractTop = Math.max(0, Math.round(top * scale));
    const extractWidth = Math.min(width - extractLeft, Math.round(boxWidth * scale));
    const extractHeight = Math.min(height - extractTop, Math.round(boxHeight * scale));

    if (extractWidth < 20 || extractHeight < 20) {
      return {
        status: "unavailable",
        reason: "The detected page area was too small to use — retake it with the page filling more of the frame.",
      };
    }

    const buffer = await oriented
      .clone()
      .extract({ left: extractLeft, top: extractTop, width: extractWidth, height: extractHeight })
      .jpeg({ quality: 90 })
      .toBuffer();

    return { status: "cropped", buffer, mimeType: "image/jpeg" };
  } catch (err) {
    console.log("[pageCropServer] unexpected error:", err);
    return {
      status: "unavailable",
      reason: "Something went wrong reading this photo — try a different one, or a different format (JPEG/PNG).",
    };
  }
}

function findLastIndex(arr: number[], pred: (v: number) => boolean): number {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (pred(arr[i])) return i;
  }
  return -1;
}
