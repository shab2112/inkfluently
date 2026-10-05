export type Passage = {
  id: string;
  topic: string;
  sentences: string[];
};

export type DimensionFlag = "good" | "needs_work";

export type LegibilityDimension = {
  name: string;
  label: string;
  flag: DimensionFlag;
  note?: string;
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
  synced: boolean;
};

export type WeeklyFocus = {
  name: string;
  label: string;
  tip: string;
};

export type PassageSkill = "longWords" | "punctuation" | "varied";
