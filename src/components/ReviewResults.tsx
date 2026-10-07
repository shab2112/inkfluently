"use client";

import type { SessionRecord } from "@/lib/types";
import { displayReviewStatus } from "@/lib/history";
import { WritingLoader } from "@/components/WritingLoader";

/**
 * The legibility/accuracy breakdown box — shared between FinishView (right
 * after saving) and SessionDetail (revisiting any past session from the Home
 * log, since there was previously no way back into this view once you left
 * the Finish screen).
 */
export function ReviewResults({
  record,
  reviewSeconds,
  onRetry,
}: {
  record: SessionRecord;
  reviewSeconds?: number;
  onRetry?: () => void;
}) {
  const status = displayReviewStatus(record);

  return (
    <div className="w-full text-left rounded-xl border px-3.5 py-3" style={{ background: "var(--paper)", borderColor: "var(--rule)" }}>
      {status === "pending" && (
        <>
          <div className="text-sm font-bold mb-2.5">Reading the handwriting…</div>
          <WritingLoader seconds={reviewSeconds} />
          <div className="text-xs mt-2.5" style={{ color: "var(--ink-soft)" }}>
            This can take a minute or two… but you don&apos;t have to wait here — head back to the log now and
            we&apos;ll keep checking in the background. It&apos;ll show up there as soon as it&apos;s ready.
          </div>
        </>
      )}
      {status === "failed" && (
        <>
          <div className="text-sm font-bold">Review unavailable</div>
          <div className="text-xs mt-1" style={{ color: "var(--ink-soft)" }}>
            {record.reviewError || "Something went wrong."} — the session and photo are still saved.
          </div>
          {onRetry && (
            <button type="button" onClick={onRetry} className="text-xs font-semibold underline mt-2 transition-opacity hover:opacity-70" style={{ color: "var(--accent)" }}>
              Retry review
            </button>
          )}
        </>
      )}
      {status === "done" && record.legibility && (
        <>
          <div className="flex items-center gap-2 text-sm font-bold">
            <span className="font-mono-ink rounded-full px-2.5 py-0.5 text-xs" style={{ background: "var(--gold-soft)", color: "var(--gold)" }}>
              {record.legibility.score}/5
            </span>
            Legibility
          </div>
          <div className="text-xs mt-1.5" style={{ color: "var(--ink-soft)" }}>
            {record.legibility.feedback || "No specific notes this time."}
          </div>
          <ul className="flex flex-col gap-1.5 mt-2">
            {record.legibility.dimensions.map((d) => {
              const badgeStyle =
                d.flag === "good"
                  ? { background: "var(--good-soft)", color: "var(--good)" }
                  : d.flag === "fair"
                  ? { background: "var(--gold-soft)", color: "var(--gold)" }
                  : { background: "var(--accent-soft)", color: "var(--danger)" };
              const badgeLabel = d.flag === "good" ? "good" : d.flag === "fair" ? "fair" : "needs work";
              return (
                <li key={d.name} className="text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span style={{ color: "var(--ink-soft)" }}>{d.label}</span>
                    <span className="rounded-full px-2 py-0.5 font-bold flex-none" style={badgeStyle}>
                      {badgeLabel}
                    </span>
                  </div>
                  {d.flag !== "good" && d.note && (
                    <div className="text-[11px] mt-0.5" style={{ color: "var(--ink-faint)" }}>
                      {d.note}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          {record.accuracy && (
            <div className="mt-3 pt-3 border-t" style={{ borderColor: "var(--rule)" }}>
              <div className="flex items-center gap-2 text-xs font-bold" style={{ color: "var(--ink-soft)" }}>
                <span className="font-mono-ink rounded-full px-2 py-0.5" style={{ background: "var(--good-soft)", color: "var(--good)" }}>
                  {record.accuracy.score}/5
                </span>
                Accuracy (secondary)
              </div>
              <div className="text-[11px] mt-1" style={{ color: "var(--ink-faint)" }}>
                {record.accuracy.summary}
              </div>
              {record.accuracy.errors.length > 0 && (
                <ul className="flex flex-col gap-1 mt-2">
                  {record.accuracy.errors.map((e, i) => (
                    <li key={i} className="text-[11px] rounded-lg px-2 py-1.5" style={{ background: "var(--paper-2)" }}>
                      <span className="text-[9.5px] font-bold uppercase tracking-wide mr-1.5" style={{ color: "var(--ink-faint)" }}>
                        {e.type}
                      </span>
                      {e.type === "missing" ? (
                        <span>
                          missing &quot;<b>{e.expected}</b>&quot;
                        </span>
                      ) : e.type === "extra" ? (
                        <span>
                          extra &quot;<b>{e.found}</b>&quot; (not in passage)
                        </span>
                      ) : (
                        <span>
                          &quot;{e.found}&quot; → should be &quot;<b>{e.expected}</b>&quot;
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          {record.neatness?.note && (
            <div className="mt-3 pt-3 border-t text-[11px]" style={{ borderColor: "var(--rule)", color: "var(--ink-faint)" }}>
              <span className="font-bold uppercase tracking-wide" style={{ color: "var(--ink-soft)" }}>
                Neatness
              </span>{" "}
              — {record.neatness.note} (doesn&apos;t affect the legibility score above)
            </div>
          )}
          <div className="text-[11px] mt-2.5" style={{ color: "var(--ink-faint)" }}>
            Scores vary a little session to session — read the trend over time, not any single score.
          </div>
        </>
      )}
    </div>
  );
}
