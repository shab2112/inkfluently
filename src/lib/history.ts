import { dateStrOffset, todayStr } from "./dates";
import type { SessionRecord, WeeklyFocus } from "./types";

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
 * dimension was flagged "needs_work" most often (minimum 2 occurrences, so one
 * bad photo doesn't read as a pattern).
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
      if (d.flag === "needs_work") {
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

/** Whole-session WPM: passage word count ÷ duration — only meaningful past 5s. */
export function computeWpm(wordCount: number, durationSec: number): number | null {
  if (durationSec < 5) return null;
  return Math.round((wordCount / durationSec) * 60);
}
