"use client";

// On-device OCR phrase-match gate (docs/spec.md §6.1): before a photo ever
// leaves the device, check whether it plausibly contains the dictated passage
// at all — catches the "wrong photo" / blank-page class of mistake. This is
// NOT a legibility or accuracy judgment (that's the server-side AI review) —
// it's a weak, lenient signal on purpose: Tesseract's handwriting recognition
// is genuinely poor, even on perfectly fine handwriting, so requiring a strong
// match would reject real sessions constantly. A handful of matching
// distinctive words is enough to pass.

const STOPWORDS = new Set([
  "the", "and", "that", "with", "this", "from", "have", "were", "which", "their",
  "about", "would", "there", "could", "these", "those", "into", "than", "then",
  "when", "what", "some", "once", "even", "only", "just", "also", "been", "being",
]);

function distinctiveWords(text: string): string[] {
  const words = text
    .toLowerCase()
    .replace(/[^a-z' -]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !STOPWORDS.has(w));
  return Array.from(new Set(words));
}

export type OcrGateResult = {
  status: "match" | "no_match" | "check_failed";
  matchedWords: string[];
  checkedWordCount: number;
  ocrTextSample: string;
};

export async function runOcrPhraseMatch(
  photo: File | Blob,
  passageText: string
): Promise<OcrGateResult> {
  const passageWords = distinctiveWords(passageText);
  if (!passageWords.length) {
    // Nothing distinctive to check against (e.g. a very short custom passage) —
    // best-effort gate has nothing to say here, so don't block on it.
    return { status: "match", matchedWords: [], checkedWordCount: 0, ocrTextSample: "" };
  }

  try {
    const { createWorker } = await import("tesseract.js");
    const worker = await createWorker("eng");
    try {
      const {
        data: { text },
      } = await worker.recognize(photo);
      const ocrWords = new Set(distinctiveWords(text));
      const matchedWords = passageWords.filter((w) => ocrWords.has(w));
      // Lenient on purpose (see module comment): 2 distinctive words, or 12% of
      // them for longer passages, is enough to call it a plausible match.
      const threshold = Math.max(2, Math.ceil(passageWords.length * 0.12));
      const status = matchedWords.length >= threshold ? "match" : "no_match";
      return {
        status,
        matchedWords,
        checkedWordCount: passageWords.length,
        ocrTextSample: text.trim().slice(0, 200),
      };
    } finally {
      await worker.terminate();
    }
  } catch (err) {
    // Best-effort filter (spec §6): a library/network failure should not brick
    // the save flow. Treat as inconclusive, not as a block.
    console.error("OCR phrase-match check failed:", err);
    return { status: "check_failed", matchedWords: [], checkedWordCount: passageWords.length, ocrTextSample: "" };
  }
}
