import type { AccuracyReview, LegibilityReview } from "./types";
import { DIMENSION_TAGS } from "./letterPatterns";

// Server-only: never import this from a "use client" component. The API key
// must never reach the browser bundle.

const DIMENSION_NAMES = [
  "letter_formation",
  "size_consistency",
  "spacing",
  "baseline",
  "slant",
] as const;

const TAG_VALUES = new Set(Object.values(DIMENSION_TAGS).flatMap((tags) => tags.map((t) => t.tag)));

function tagVocabularyBlock(): string {
  return DIMENSION_NAMES.map((dim) => {
    const tags = DIMENSION_TAGS[dim].map((t) => `"${t.tag}"`).join(", ");
    return `   - ${dim}: ${tags}`;
  }).join("\n");
}

function buildReviewPrompt(passageText: string, userAge: number | null): string {
  const ageClause = userAge
    ? `a ${userAge}-year-old`
    : "a student";
  return (
    `You are looking at a photo of handwriting ${ageClause} produced during a home ` +
    `dictation practice session. They were read the following passage aloud, one sentence at a time, ` +
    `and asked to write down exactly what they heard:\n\n"${passageText}"\n\n` +
    "Do two assessments, and make sure they AGREE WITH EACH OTHER (see the note at the end — this matters):\n" +
    "1. LEGIBILITY — judge how easy the handwriting itself is to read, broken into these five named " +
    "dimensions (not content/accuracy):\n" +
    "   - letter_formation: are individual letters well-shaped (watch for reversed b/d, malformed g/y, unclosed " +
    "a/o, and — a small but documented factor — missing dots over i's or crosses on t's)?\n" +
    "   - size_consistency: do letters hold a consistent height, or does size wander within a word/line?\n" +
    "   - spacing: consistent gaps between letters and words. Research on children's handwriting (Ayres, 1912, " +
    "timed-reading study of 1,578 student samples) found this to be the single biggest factor in legibility — " +
    "bigger than letter shape itself. Watch specifically for: words crowded together with no real gap between " +
    "them, a line broken mid-word so it reads like two separate words, and inconsistent gaps between lines.\n" +
    "   - baseline: this is about CONSISTENCY, not touching the printed rule exactly — does the writing's " +
    "position wander/drift up or down as a line goes on, or line to line? A child who consistently writes a " +
    "little above or below the printed line, evenly, the same way every time, is a stable personal style, not " +
    "a legibility problem — only flag this if the vertical position genuinely varies within the same piece of " +
    "writing, not merely because it isn't glued to the printed rule.\n" +
    "   - slant: is the slant consistent, or does it vary erratically letter to letter?\n" +
    '   For each dimension give a flag of exactly "good" or "needs_work", and when it\'s "needs_work" a short, ' +
    'specific, concrete note (e.g. "height varies noticeably between words") — omit the note when "good". ' +
    "Also give one overall 1-5 score and one short overall encouraging sentence.\n" +
    "   When a dimension is \"needs_work\", ALSO pick exactly one `tag` from this fixed list for that specific " +
    "dimension (reuse the SAME tag every time you see the same specific issue — this is what lets the app track " +
    "whether a specific mistake is recurring across sessions, so don't invent new wording, pick from the list; " +
    "use \"other\" only if truly none of the rest fit):\n" +
    tagVocabularyBlock() +
    "\n   Also give an `example_word` — the single word from the passage above where this issue is clearest in " +
    "the photo (so the app can show the user exactly where to look). Omit tag/example_word when the flag is " +
    "\"good\".\n" +
    "2. ACCURACY — transcribe what they actually wrote as best you can, then compare it word-for-word to the " +
    "passage above. List concrete differences: misspelled words, missing words/phrases, extra words, and " +
    "punctuation or capitalization mistakes. If the handwriting is too unclear to transcribe reliably in " +
    "places, say so honestly instead of guessing.\n\n" +
    "IMPORTANT — reconcile the two: for every difference you list in ACCURACY, ask yourself why it happened. " +
    "If you had to guess at a word because a specific letter's shape was ambiguous or resembled a different " +
    "letter (e.g. a reading as o, s reading as r or e) — that is a LEGIBILITY problem, not a spelling gap, even " +
    "if the writer clearly knows the correct word. In that case letter_formation must NOT be marked \"good\" — " +
    "mark it \"needs_work\" and name the specific confusable letters in its note. Only treat a difference as " +
    "pure accuracy (the writer genuinely wrote, spelled, or punctuated something different) when the letters " +
    "themselves were clearly and unambiguously formed. Do not mark every legibility dimension \"good\" while " +
    "simultaneously listing several accuracy errors that came from hard-to-read letters — that is a contradiction.\n\n" +
    "Reply with ONLY a JSON object of this exact shape:\n" +
    '{"legibility": {"score": <integer 1-5, 5=very easy to read>, "feedback": "<one short encouraging sentence>", ' +
    '"dimensions": [{"name":"letter_formation","label":"Letter formation","flag":"good"|"needs_work","note":"<string, omit or empty when good>","tag":"<from the list above, omit when good>","example_word":"<word from the passage, omit when good>"}, ' +
    '{"name":"size_consistency","label":"Size consistency","flag":"good"|"needs_work","note":"<...>","tag":"<...>","example_word":"<...>"}, ' +
    '{"name":"spacing","label":"Spacing","flag":"good"|"needs_work","note":"<...>","tag":"<...>","example_word":"<...>"}, ' +
    '{"name":"baseline","label":"Baseline","flag":"good"|"needs_work","note":"<...>","tag":"<...>","example_word":"<...>"}, ' +
    '{"name":"slant","label":"Slant","flag":"good"|"needs_work","note":"<...>","tag":"<...>","example_word":"<...>"}]}, ' +
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

// Sorted-letter-pair -> dimension tag, mirroring the confusable pairs named in
// the prompt's reconciliation instruction (see buildReviewPrompt). The model
// following that instruction is unreliable in practice (~1 in 3 real runs
// still mark letter_formation "good" while listing one of these exact swaps
// as a spelling error) — this is a deterministic cross-check that doesn't
// depend on the model's self-consistency: if a single-letter spelling error
// is exactly one of these known confusable swaps, letter_formation can't
// honestly be "good" regardless of what the model said.
const CONFUSABLE_PAIRS: Record<string, string> = {
  ao: "a-o",
  rs: "s-r",
  es: "s-e",
  nu: "n-u",
};

function confusableSwapTag(expected: string, found: string): string | null {
  if (!expected || !found || expected.length !== found.length) return null;
  const e = expected.toLowerCase();
  const f = found.toLowerCase();
  let diffIdx = -1;
  let diffCount = 0;
  for (let i = 0; i < e.length; i++) {
    if (e[i] !== f[i]) {
      diffCount++;
      diffIdx = i;
      if (diffCount > 1) return null;
    }
  }
  if (diffCount !== 1) return null;
  const pairKey = [e[diffIdx], f[diffIdx]].sort().join("");
  return CONFUSABLE_PAIRS[pairKey] || null;
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
  // Defaults to Gemma 4 per docs/spec.md §7 (free on Google AI Studio for
  // dev/testing — paid tier required before any real user's photos are sent,
  // see §7/§10). gemma-3-27b-it (an earlier default) no longer exists in the
  // API's model list as of Oct 2026 (404) — superseded by Gemma 4. Verified
  // directly against the API with a real photo: gemma-4-26b-a4b-it reliably
  // accepts image input; its sibling gemma-4-31b-it does not (failed
  // consistently with a 500/connection-reset on every attempt) — don't use
  // that one. If this call ever fails with code "image_input_unsupported"
  // below, set GEMINI_MODEL=gemini-2.5-flash in .env.local, which reliably
  // accepts images on every account regardless of Gemma's availability.
  const model = process.env.GEMINI_MODEL || "gemma-4-26b-a4b-it";
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

  // Transient 5xx responses from this API happen in practice (verified: the
  // identical request succeeded on an immediate retry) — retry a couple of
  // times with a short backoff before surfacing an error, rather than making
  // the user manually redo it every time Google's side has a momentary blip.
  const maxAttempts = 3;
  let res: Response | null = null;
  let lastErrorText = "";
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch (e) {
      console.error("[gemini fetch threw]", e);
      throw new GeminiReviewError("network_error", "Could not reach the Gemini API: " + (e instanceof Error ? e.message : String(e)));
    }
    if (res.ok || res.status < 500 || attempt === maxAttempts) break;
    lastErrorText = await res.text().catch(() => "");
    await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
  }

  const finalRes = res as Response;
  if (!finalRes.ok) {
    const text = finalRes.status >= 500 ? lastErrorText : await finalRes.text().catch(() => "");
    const imageRejected = finalRes.status === 400 && /image input modality is not enabled/i.test(text);
    throw new GeminiReviewError(
      imageRejected ? "image_input_unsupported" : finalRes.status === 429 ? "rate_limited" : "upstream_error",
      imageRejected
        ? `The model "${model}" rejected image input — set GEMINI_MODEL to a Gemini model (e.g. gemini-2.5-flash) in .env.local instead.`
        : `Gemini API returned ${finalRes.status}: ${text.slice(0, 300)}`
    );
  }

  const json = await finalRes.json();
  // Reasoning models (e.g. Gemma 4) return multiple parts: an internal
  // chain-of-thought part marked `thought: true` first, then the real answer
  // in a later part — verified directly against the API. Skip thought parts
  // rather than assuming parts[0] is the answer (that was the actual cause of
  // "bad_json" failures: we were trying to JSON.parse the reasoning trace).
  const parts: Array<{ text?: string; thought?: boolean }> = json?.candidates?.[0]?.content?.parts || [];
  const text = parts.find((p) => !p.thought && p.text)?.text;
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
        .map((d) => {
          const rawTag = typeof d.tag === "string" ? d.tag : undefined;
          return {
            name: String(d.name),
            label: String(d.label || d.name),
            flag: d.flag as "good" | "needs_work",
            note: String(d.note || "").trim() || undefined,
            // Guard against the model inventing a tag outside the fixed
            // vocabulary — an off-list tag would never match anything else
            // and would silently break cross-session aggregation.
            tag: rawTag && TAG_VALUES.has(rawTag) ? rawTag : undefined,
            exampleWord: String(d.example_word || "").trim() || undefined,
          };
        })
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

  // Deterministic reconciliation: don't just trust the prompt's "reconcile
  // legibility and accuracy" instruction worked (see buildReviewPrompt) —
  // verify it. `dims` and `errors` are the same array instances referenced by
  // `legibility`/`accuracy` above, so mutating here updates both.
  const letterFormation = dims.find((d) => d.name === "letter_formation");
  if (letterFormation && letterFormation.flag === "good") {
    for (const err of errors) {
      if (err.type !== "spelling") continue;
      const tag = confusableSwapTag(err.expected, err.found);
      if (!tag) continue;
      letterFormation.flag = "needs_work";
      letterFormation.tag = tag;
      letterFormation.note = `"${err.found}" was read where "${err.expected}" was written — that specific letter shape looks ambiguous here.`;
      letterFormation.exampleWord = err.expected;
      break;
    }
  }

  return { legibility, accuracy };
}
