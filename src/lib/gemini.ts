import type { AccuracyReview, LegibilityReview } from "./types";

// Server-only: never import this from a "use client" component. The API key
// must never reach the browser bundle.

const DIMENSION_NAMES = [
  "letter_formation",
  "size_consistency",
  "spacing",
  "baseline",
  "slant",
] as const;

function buildReviewPrompt(passageText: string, userAge: number | null): string {
  const ageClause = userAge
    ? `a ${userAge}-year-old`
    : "a student";
  return (
    `You are looking at a photo of handwriting ${ageClause} produced during a home ` +
    `dictation practice session. They were read the following passage aloud, one sentence at a time, ` +
    `and asked to write down exactly what they heard:\n\n"${passageText}"\n\n` +
    "Do two separate assessments:\n" +
    "1. LEGIBILITY — judge how easy the handwriting itself is to read, broken into these five named " +
    "dimensions (not content/accuracy):\n" +
    "   - letter_formation: are individual letters well-shaped (watch for reversed b/d, malformed g/y, unclosed a/o)?\n" +
    "   - size_consistency: do letters hold a consistent height, or does size wander within a word/line?\n" +
    "   - spacing: consistent gaps between letters and words, not cramped or overly wide?\n" +
    "   - baseline: does writing sit on the line, or drift up/down across a line?\n" +
    "   - slant: is the slant consistent, or does it vary erratically letter to letter?\n" +
    '   For each dimension give a flag of exactly "good" or "needs_work", and when it\'s "needs_work" a short, ' +
    'specific, concrete note (e.g. "height varies noticeably between words") — omit the note when "good". ' +
    "Also give one overall 1-5 score and one short overall encouraging sentence.\n" +
    "2. ACCURACY — transcribe what they actually wrote as best you can, then compare it word-for-word to the " +
    "passage above. List concrete differences: misspelled words, missing words/phrases, extra words, and " +
    "punctuation or capitalization mistakes. If the handwriting is too unclear to transcribe reliably in " +
    "places, say so honestly instead of guessing.\n\n" +
    "Reply with ONLY a JSON object of this exact shape:\n" +
    '{"legibility": {"score": <integer 1-5, 5=very easy to read>, "feedback": "<one short encouraging sentence>", ' +
    '"dimensions": [{"name":"letter_formation","label":"Letter formation","flag":"good"|"needs_work","note":"<string, omit or empty when good>"}, ' +
    '{"name":"size_consistency","label":"Size consistency","flag":"good"|"needs_work","note":"<...>"}, ' +
    '{"name":"spacing","label":"Spacing","flag":"good"|"needs_work","note":"<...>"}, ' +
    '{"name":"baseline","label":"Baseline","flag":"good"|"needs_work","note":"<...>"}, ' +
    '{"name":"slant","label":"Slant","flag":"good"|"needs_work","note":"<...>"}]}, ' +
    '"accuracy": {"score": <integer 1-5, 5=matches perfectly>, ' +
    '"errors": [{"type": "spelling"|"punctuation"|"missing"|"extra", "expected": "<correct text>", "found": "<what they wrote, or empty if missing>"}], ' +
    '"summary": "<one encouraging sentence naming the main thing to work on>"}}'
  );
}

function clampScore(n: unknown): number | null {
  const v = Math.round(Number(n));
  if (Number.isNaN(v)) return null;
  return Math.min(5, Math.max(1, v));
}

export class GeminiReviewError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

export async function reviewHandwritingPhoto(
  imageBase64: string,
  mimeType: string,
  passageText: string,
  userAge: number | null
): Promise<{ legibility: LegibilityReview | null; accuracy: AccuracyReview | null }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new GeminiReviewError(
      "missing_api_key",
      "GEMINI_API_KEY is not configured on the server."
    );
  }
  // Defaults to Gemma 3 per docs/spec.md §7 (free on Google AI Studio for
  // dev/testing — paid tier required before any real user's photos are sent,
  // see §7/§10). Known, accepted risk: some accounts report gemma-3-27b-it
  // rejecting image input ("Image input modality is not enabled") despite
  // being announced as multimodal. If this call fails with code
  // "image_input_unsupported" below, set GEMINI_MODEL=gemini-2.5-flash in
  // .env.local, which reliably accepts images on every account.
  const model = process.env.GEMINI_MODEL || "gemma-3-27b-it";
  const prompt = buildReviewPrompt(passageText, userAge);

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const body = {
    contents: [
      {
        parts: [
          { text: prompt },
          { inline_data: { mime_type: mimeType, data: imageBase64 } },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: "application/json",
    },
  };

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new GeminiReviewError("network_error", "Could not reach the Gemini API.");
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const imageRejected = res.status === 400 && /image input modality is not enabled/i.test(text);
    throw new GeminiReviewError(
      imageRejected ? "image_input_unsupported" : res.status === 429 ? "rate_limited" : "upstream_error",
      imageRejected
        ? `The model "${model}" rejected image input — set GEMINI_MODEL to a Gemini model (e.g. gemini-2.5-flash) in .env.local instead.`
        : `Gemini API returned ${res.status}: ${text.slice(0, 300)}`
    );
  }

  const json = await res.json();
  const text: string | undefined = json?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new GeminiReviewError("empty_completion", "Gemini returned no result for this photo.");
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new GeminiReviewError("bad_json", "Gemini's response wasn't valid JSON.");
  }

  const legRaw = (parsed.legibility ?? {}) as Record<string, unknown>;
  const accRaw = (parsed.accuracy ?? {}) as Record<string, unknown>;

  const legScore = clampScore(legRaw.score);
  const dims = Array.isArray(legRaw.dimensions)
    ? (legRaw.dimensions as Record<string, unknown>[])
        .filter(
          (d) =>
            d &&
            typeof d.name === "string" &&
            DIMENSION_NAMES.includes(d.name as (typeof DIMENSION_NAMES)[number]) &&
            (d.flag === "good" || d.flag === "needs_work")
        )
        .map((d) => ({
          name: String(d.name),
          label: String(d.label || d.name),
          flag: d.flag as "good" | "needs_work",
          note: String(d.note || "").trim() || undefined,
        }))
    : [];

  const legibility: LegibilityReview | null =
    legScore != null
      ? { score: legScore, feedback: String(legRaw.feedback || "").trim(), dimensions: dims }
      : null;

  const accScore = clampScore(accRaw.score);
  const errors = Array.isArray(accRaw.errors)
    ? (accRaw.errors as Record<string, unknown>[]).map((e) => ({
        type: (["spelling", "punctuation", "missing", "extra"].includes(e.type as string)
          ? e.type
          : "spelling") as "spelling" | "punctuation" | "missing" | "extra",
        expected: String(e.expected || ""),
        found: String(e.found || ""),
      }))
    : [];

  const accuracy: AccuracyReview | null =
    accScore != null
      ? { score: accScore, errors, summary: String(accRaw.summary || "").trim() }
      : null;

  return { legibility, accuracy };
}
