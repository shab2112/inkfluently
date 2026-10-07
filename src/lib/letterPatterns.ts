// Fixed vocabulary of specific, recurring-issue tags per legibility dimension.
// This is the single source of truth for both (a) what we ask the AI review
// prompt to pick from (src/lib/gemini.ts) and (b) how we label those tags in
// the UI — keeping one list means the prompt's vocabulary and the UI's labels
// can never drift apart. A FIXED, reused vocabulary (rather than letting the
// model invent fresh wording each time) is what makes it possible to tally
// "this is the third time this specific thing happened" instead of treating
// every session's free-text note as a one-off.
export const DIMENSION_TAGS: Record<string, { tag: string; label: string }[]> = {
  letter_formation: [
    { tag: "a-o", label: "'a' reads as 'o'" },
    { tag: "s-r", label: "'s' reads as 'r'" },
    { tag: "s-e", label: "'s' reads as 'e'" },
    { tag: "n-u", label: "'n' reads as 'u'" },
    { tag: "b-d-reversal", label: "b/d reversal" },
    { tag: "g-y-malformed", label: "malformed g/y" },
    { tag: "unclosed-loops", label: "unclosed loops (a/o/e)" },
    { tag: "missing-dots-crosses", label: "missing dots on i's / crosses on t's" },
    { tag: "other", label: "other letter-formation issue" },
  ],
  size_consistency: [
    { tag: "height-varies-within-word", label: "height varies within a word" },
    { tag: "height-varies-across-line", label: "height varies across the line" },
    { tag: "other", label: "other size-consistency issue" },
  ],
  spacing: [
    { tag: "word-crowding", label: "words crowded together" },
    { tag: "line-crowding", label: "lines crowded together" },
    { tag: "line-break-mid-word", label: "line breaks fall mid-word" },
    { tag: "other", label: "other spacing issue" },
  ],
  baseline: [
    { tag: "drifts-upward", label: "writing drifts upward" },
    { tag: "drifts-downward", label: "writing drifts downward" },
    { tag: "other", label: "other baseline issue" },
  ],
  slant: [
    { tag: "erratic-letter-to-letter", label: "slant varies letter to letter" },
    { tag: "other", label: "other slant issue" },
  ],
};

export function tagLabel(dimension: string, tag: string): string {
  const found = DIMENSION_TAGS[dimension]?.find((t) => t.tag === tag);
  return found?.label || tag;
}

export type RecurringPattern = {
  dimension: string;
  dimensionLabel: string;
  tag: string;
  tagLabel: string;
  count: number;
  windowSize: number;
  lastSeenDate: string;
  lastSeenSeq: number;
  lastExampleWord?: string;
  trend: "improving" | "steady" | "worsening" | "new";
};
