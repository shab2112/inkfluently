import { dateStrOffset, todayStr } from "./dates";
import type { ReviewStatus, SessionRecord, WeeklyFocus } from "./types";
import { tagLabel, type RecurringPattern } from "./letterPatterns";

/** Records saved before `reviewStatus` existed don't have it set — infer from
 * whether legibility ever landed, so old sessions don't show as permanently
 * "pending". */
export function displayReviewStatus(record: SessionRecord): ReviewStatus {
  if (record.reviewStatus) return record.reviewStatus;
  return record.legibility ? "done" : "failed";
}

export function computeStreak(history: SessionRecord[]): { current: number; best: number } {
  const doneDates: Record<string, boolean> = {};
  history.forEach((h) => {
    doneDates[h.date] = true;
  });

  let cur = 0;
  const startOffset = doneDates[todayStr()] ? 0 : -1;
  let i = startOffset;
  while (doneDates[dateStrOffset(i)]) {
    cur++;
    i--;
  }

  const allDates = Object.keys(doneDates).sort();
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  allDates.forEach((ds) => {
    if (prev) {
      const prevD = new Date(prev).getTime();
      const curD = new Date(ds).getTime();
      const diff = Math.round((curD - prevD) / 86400000);
      run = diff === 1 ? run + 1 : 1;
    } else {
      run = 1;
    }
    best = Math.max(best, run);
    prev = ds;
  });
  best = Math.max(best, cur);
  return { current: cur, best };
}

const DIM_TIPS: Record<string, string> = {
  letter_formation: "Focus on forming each letter clearly and fully.",
  size_consistency: "Keep letters the same height across a word.",
  spacing: "Leave even, consistent gaps between words and letters.",
  baseline: "Try to keep writing sitting on the line.",
  slant: "Aim for a consistent slant from letter to letter.",
};

/**
 * Scans the last 7 sessions' legibility-dimension flags and surfaces whichever
 * dimension was flagged "fair" or "needs_work" most often (minimum 2
 * occurrences, so one bad photo doesn't read as a pattern).
 */
export function computeWeeklyFocus(history: SessionRecord[]): WeeklyFocus | null {
  const recent = history
    .slice()
    .sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      return (b.seq || 1) - (a.seq || 1);
    })
    .slice(0, 7);

  const counts: Record<string, number> = {};
  const lastNote: Record<string, { label: string; note?: string }> = {};
  recent.forEach((h) => {
    if (!h.legibility || !Array.isArray(h.legibility.dimensions)) return;
    h.legibility.dimensions.forEach((d) => {
      if (d.flag !== "good") {
        counts[d.name] = (counts[d.name] || 0) + 1;
        if (!lastNote[d.name]) lastNote[d.name] = { label: d.label, note: d.note };
      }
    });
  });

  let best: string | null = null;
  let bestCount = 0;
  Object.keys(counts).forEach((name) => {
    if (counts[name] > bestCount) {
      bestCount = counts[name];
      best = name;
    }
  });
  if (!best || bestCount < 2) return null;

  const label = lastNote[best]?.label || best;
  const tip = lastNote[best]?.note || DIM_TIPS[best] || `Work on ${label.toLowerCase()}.`;
  return { name: best, label, tip: "This week: " + tip };
}

/**
 * Tracks SPECIFIC recurring issues (e.g. "a reads as o") across sessions, not
 * just which dimension gets flagged in general (that's computeWeeklyFocus).
 * This is only possible because the AI review now tags each flagged
 * dimension with a stable identifier from a fixed vocabulary (see
 * src/lib/letterPatterns.ts) instead of free text — otherwise there's no
 * reliable way to tell "the AI described the same issue differently" apart
 * from "this is actually a different issue."
 */
export function computeRecurringPatterns(history: SessionRecord[], lookback = 10): RecurringPattern[] {
  const withLegibility = history
    .filter((h) => h.legibility && Array.isArray(h.legibility.dimensions))
    .sort((a, b) => (a.date !== b.date ? (a.date < b.date ? -1 : 1) : (a.seq || 1) - (b.seq || 1)));
  const windowSessions = withLegibility.slice(-lookback);
  const windowSize = windowSessions.length;
  if (windowSize === 0) return [];

  const midpoint = Math.floor(windowSize / 2);

  type Occurrence = { index: number; date: string; seq: number; exampleWord?: string };
  const occurrences: Record<string, Occurrence[]> = {}; // key: `${dimension}::${tag}`
  const dimensionLabels: Record<string, string> = {};

  windowSessions.forEach((session, index) => {
    session.legibility!.dimensions.forEach((d) => {
      if (d.flag === "good" || !d.tag) return;
      dimensionLabels[d.name] = d.label;
      const key = `${d.name}::${d.tag}`;
      (occurrences[key] ||= []).push({ index, date: session.date, seq: session.seq, exampleWord: d.exampleWord });
    });
  });

  const patterns: RecurringPattern[] = Object.entries(occurrences)
    .filter(([, occ]) => occ.length >= 2)
    .map(([key, occ]) => {
      const [dimension, tag] = key.split("::");
      const firstHalfCount = occ.filter((o) => o.index < midpoint).length;
      const secondHalfCount = occ.filter((o) => o.index >= midpoint).length;
      let trend: RecurringPattern["trend"] = "steady";
      if (firstHalfCount === 0 && secondHalfCount > 0) trend = "new";
      else if (secondHalfCount < firstHalfCount) trend = "improving";
      else if (secondHalfCount > firstHalfCount) trend = "worsening";

      const last = occ[occ.length - 1];
      return {
        dimension,
        dimensionLabel: dimensionLabels[dimension] || dimension,
        tag,
        tagLabel: tagLabel(dimension, tag),
        count: occ.length,
        windowSize,
        lastSeenDate: last.date,
        lastSeenSeq: last.seq,
        lastExampleWord: last.exampleWord,
        trend,
      };
    })
    .sort((a, b) => b.count - a.count);

  return patterns;
}

// Reported handwriting speed for students is typically ~20-35 wpm; this is
// generous well beyond even a very fast writer, specifically to catch a
// timer bug rather than a real result — one real session showed 309 wpm,
// physically impossible for handwriting, traced to the practice timer
// getting reset mid-session (observed during this app's own dev-mode
// hot-reloading, not expected in production, but the display should never
// trust an impossible number either way).
const MAX_PLAUSIBLE_WPM = 150;

/** Whole-session WPM: passage word count ÷ duration — only meaningful past 5s. */
export function computeWpm(wordCount: number, durationSec: number): number | null {
  if (durationSec < 5) return null;
  const wpm = Math.round((wordCount / durationSec) * 60);
  return wpm > MAX_PLAUSIBLE_WPM ? null : wpm;
}
