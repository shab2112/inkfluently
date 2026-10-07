"use client";

import type { SessionRecord } from "@/lib/types";
import { ReviewResults } from "@/components/ReviewResults";

function fmtClock(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s < 10 ? "0" : ""}${s}`;
}

/**
 * Revisiting any past session's full analysis from the Home log — there was
 * previously no way back into this view once you left the Finish screen
 * right after saving.
 */
export function SessionDetail({
  record,
  onRetry,
  onClose,
}: {
  record: SessionRecord;
  onRetry: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 flex flex-col px-5 pt-5 pb-5 overflow-y-auto z-10" style={{ background: "var(--paper)" }}>
      <div className="max-w-[480px] lg:max-w-3xl mx-auto w-full flex flex-col gap-4">
        <div className="flex items-center justify-between gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full border text-base transition-transform hover:bg-[var(--paper-3)] active:scale-90"
            style={{ background: "var(--paper-2)", borderColor: "var(--rule)", color: "var(--ink-soft)" }}
          >
            ✕
          </button>
          <span className="text-xs uppercase tracking-wide rounded-full border px-3 py-1.5" style={{ background: "var(--paper-2)", borderColor: "var(--rule)", color: "var(--ink-soft)" }}>
            {record.date} {record.seq > 1 ? `#${record.seq}` : ""}
          </span>
          <span className="w-9" />
        </div>

        <div>
          <h2 className="text-lg font-bold">{record.topic}</h2>
          <p className="text-sm" style={{ color: "var(--ink-soft)" }}>
            Practiced for <span className="font-mono-ink">{fmtClock(record.durationSec)}</span>
            {record.note ? ` — "${record.note}"` : ""}
          </p>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-start gap-4">
          <div className="lg:w-[320px] lg:flex-none flex flex-col gap-4">
            {record.photo && (
              <div className="rounded-2xl border overflow-hidden" style={{ borderColor: "var(--rule)" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={record.photo.src}
                  alt=""
                  className="w-full transition-transform duration-300 hover:scale-105"
                />
              </div>
            )}

            {record.wpm != null && (
              <div className="w-full rounded-xl p-3.5" style={{ background: "var(--paper-2)" }}>
                <div className="font-serif-brand text-2xl font-bold">{record.wpm}</div>
                <div className="text-xs" style={{ color: "var(--ink-soft)" }}>
                  Words per minute
                </div>
              </div>
            )}
          </div>

          <div className="lg:flex-1 lg:min-w-0">
            <ReviewResults record={record} onRetry={onRetry} />
          </div>
        </div>
      </div>
    </div>
  );
}
