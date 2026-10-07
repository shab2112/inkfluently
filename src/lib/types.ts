export type Passage = {
  id: string;
  topic: string;
  sentences: string[];
};

// Three tiers, not two — a binary good/needs_work can't distinguish "one or
// two shapes are sometimes ambiguous but words stay readable" (fair) from
// "a letter is regularly misread as another" (needs_work). Collapsing those
// was exactly how a page with real d/cl and a/o confusions still scored
// 5/5 "good" across the board (see docs/spec.md and the review-rubric
// feedback that prompted this).
export type DimensionFlag = "good" | "fair" | "needs_work";

export type LegibilityDimension = {
  name: string;
  label: string;
  flag: DimensionFlag;
  note?: string;
  // Stable, from-a-fixed-vocabulary identifier for the SPECIFIC recurring
  // issue (e.g. "a-o", "word-crowding") — distinct from `note`, which is free
  // text and too inconsistently worded run-to-run to tally across sessions.
  // See DIMENSION_TAGS in gemini.ts for the vocabulary each dimension can use.
  tag?: string;
  // The specific word from this session's passage that best demonstrates the
  // issue, so the user's own photo can be captioned with exactly where to
  // look rather than just a generic score.
  exampleWord?: string;
};

export type LegibilityReview = {
  score: number;
  feedback: string;
  dimensions: LegibilityDimension[];
};

export type AccuracyErrorType = "spelling" | "punctuation" | "missing" | "extra";

export type AccuracyError = {
  type: AccuracyErrorType;
  expected: string;
  found: string;
};

export type AccuracyReview = {
  score: number;
  errors: AccuracyError[];
  summary: string;
};

export type PhotoRef = {
  kind: "local" | "remote";
  src: string; // data URL (local) or storage URL (remote)
};

// Deliberately separate from LegibilityReview: crossings-out and overwriting
// are worth surfacing to a parent, but must never affect the legibility
// score itself — a messy-but-legible page and a neat-but-illegible one are
// different problems.
export type NeatnessReview = {
  note: string;
};

// "pending"/"failed" let the review run independent of any screen staying
// mounted (see src/components/InkfluentlyApp.tsx's triggerReview) — the user
// can navigate away and back, or close the gap between sessions, and the log
// still shows accurate status instead of silently losing track of it.
export type ReviewStatus = "pending" | "done" | "failed";

export type SessionRecord = {
  date: string; // YYYY-MM-DD
  seq: number; // which session that day (1-based)
  topic: string;
  passageText: string;
  durationSec: number;
  wordCount: number;
  wpm: number | null;
  photo: PhotoRef | null;
  note: string;
  legibility: LegibilityReview | null;
  accuracy: AccuracyReview | null;
  neatness?: NeatnessReview | null;
  synced: boolean;
  reviewStatus?: ReviewStatus; // absent = pre-existing record from before this field existed
  reviewError?: string;
};

export type WeeklyFocus = {
  name: string;
  label: string;
  tip: string;
};

export type PassageSkill = "longWords" | "punctuation" | "varied";
