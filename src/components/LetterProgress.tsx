"use client";

import type { SessionRecord } from "@/lib/types";
import { computeRecurringPatterns } from "@/lib/history";
import type { RecurringPattern } from "@/lib/letterPatterns";

const TREND_STYLE: Record<RecurringPattern["trend"], { label: string; bg: string; fg: string }> = {
  improving: { label: "↘ improving", bg: "var(--good-soft)", fg: "var(--good)" },
  steady: { label: "→ steady", bg: "var(--gold-soft)", fg: "var(--gold)" },
  worsening: { label: "↗ needs attention", bg: "var(--accent-soft)", fg: "var(--accent)" },
  new: { label: "✦ new", bg: "var(--gold-soft)", fg: "var(--gold)" },
};

/**
 * Surfaces SPECIFIC recurring issues (e.g. "a reads as o", appearing in 4 of
 * the last 10 sessions) rather than just a dimension score — the user asked
 * for this explicitly: a weekly score alone doesn't show a kid which exact
 * mistake keeps happening, or that it's the same one from last month.
 */
export function LetterProgress({ history, onClose }: { history: SessionRecord[]; onClose: () => void }) {
  const patterns = computeRecurringPatterns(history);

  return (
    <div className="max-w-2xl mx-auto px-4 py-7 pb-16 flex flex-col gap-4">
      <Header onClose={onClose} />
      <h2 className="text-xl font-bold">Letter progress</h2>
      <p className="text-sm" style={{ color: "var(--ink-soft)" }}>
        The specific things that keep coming up across sessions — not just a score, but exactly what to practice
        next.
      </p>

      {patterns.length === 0 && (
        <div className="text-sm py-8 text-center" style={{ color: "var(--ink-faint)" }}>
          Nothing recurring yet — a pattern shows up here once the same specific issue (like a particular letter
          mix-up) appears in at least two sessions.
        </div>
      )}

      {patterns.map((p) => (
        <PatternCard key={`${p.dimension}::${p.tag}`} pattern={p} history={history} />
      ))}
    </div>
  );
}

function PatternCard({ pattern, history }: { pattern: RecurringPattern; history: SessionRecord[] }) {
  const trend = TREND_STYLE[pattern.trend];
  const record = history.find((h) => h.date === pattern.lastSeenDate && h.seq === pattern.lastSeenSeq);

  return (
    <div className="rounded-2xl p-4 border flex flex-col gap-3" style={{ background: "var(--paper-2)", borderColor: "var(--rule)" }}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-[10.5px] font-bold uppercase tracking-wide" style={{ color: "var(--ink-soft)" }}>
            {pattern.dimensionLabel}
          </div>
          <div className="text-base font-bold">{pattern.tagLabel}</div>
        </div>
        <span className="rounded-full px-2.5 py-1 text-xs font-bold flex-none" style={{ background: trend.bg, color: trend.fg }}>
          {trend.label}
        </span>
      </div>

      <div className="text-xs" style={{ color: "var(--ink-soft)" }}>
        Showed up in <b>{pattern.count}</b> of the last <b>{pattern.windowSize}</b> sessions
        {record ? ` · last seen ${record.date}${record.seq > 1 ? ` #${record.seq}` : ""}` : ""}
      </div>

      {record?.photo && (
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5 min-w-0">
            <div className="text-[9.5px] font-bold uppercase tracking-wide" style={{ color: "var(--ink-faint)" }}>
              What was written
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={record.photo.src}
              alt=""
              className="w-full aspect-[3/4] object-cover rounded-xl border"
              style={{ borderColor: "var(--rule)", background: "var(--paper-3)" }}
            />
            {pattern.lastExampleWord && (
              <div className="text-[11px]" style={{ color: "var(--ink-soft)" }}>
                Look for: <b>&quot;{pattern.lastExampleWord}&quot;</b>
              </div>
            )}
          </div>
          <div className="flex flex-col gap-1.5 min-w-0">
            <div className="text-[9.5px] font-bold uppercase tracking-wide" style={{ color: "var(--ink-faint)" }}>
              How it&apos;s taught
            </div>
            <div
              className="w-full aspect-[3/4] rounded-xl border flex items-center justify-center p-3"
              style={{ borderColor: "var(--rule)", background: "var(--paper)" }}
            >
              {pattern.lastExampleWord ? (
                <span className="text-3xl text-center break-words" style={{ fontFamily: "'Playwrite US Modern Guides', cursive" }}>
                  {pattern.lastExampleWord}
                </span>
              ) : (
                <span className="text-xs text-center" style={{ color: "var(--ink-faint)" }}>
                  No reference word recorded for this one yet.
                </span>
              )}
            </div>
            <div className="text-[11px]" style={{ color: "var(--ink-soft)" }}>
              A reference for how this is usually taught — not a claim about this photo&apos;s own exact shapes.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Header({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex items-center justify-between gap-2.5 mb-1.5">
      <button
        type="button"
        onClick={onClose}
        className="w-9 h-9 rounded-full border text-base"
        style={{ background: "var(--paper-2)", borderColor: "var(--rule)", color: "var(--ink-soft)" }}
      >
        ✕
      </button>
      <span
        className="text-xs uppercase tracking-wide rounded-full border px-3 py-1.5"
        style={{ background: "var(--paper-2)", borderColor: "var(--rule)", color: "var(--ink-soft)" }}
      >
        Letter progress
      </span>
      <span className="w-9" />
    </div>
  );
}
