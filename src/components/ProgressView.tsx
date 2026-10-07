"use client";

import { useState } from "react";
import type { SessionRecord } from "@/lib/types";

export function ProgressView({ history, onClose }: { history: SessionRecord[]; onClose: () => void }) {
  const withPhotos = history
    .filter((h) => h.photo)
    .sort((a, b) => (a.date !== b.date ? (a.date < b.date ? -1 : 1) : (a.seq || 1) - (b.seq || 1)));

  const [leftIdx, setLeftIdx] = useState(0);
  const [rightIdx, setRightIdx] = useState(Math.max(0, withPhotos.length - 1));

  if (withPhotos.length < 2) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-7 pb-16">
        <Header onClose={onClose} />
        <div className="text-sm py-8 text-center" style={{ color: "var(--ink-faint)" }}>
          Save at least two sessions with photos to compare — keep practicing!
        </div>
      </div>
    );
  }

  const left = withPhotos[leftIdx];
  const right = withPhotos[rightIdx];

  return (
    <div className="max-w-2xl lg:max-w-3xl mx-auto px-4 py-7 pb-16 flex flex-col gap-4">
      <Header onClose={onClose} />
      <h2 className="text-xl font-bold">See the difference</h2>
      <p className="text-sm" style={{ color: "var(--ink-soft)" }}>
        The actual pages, side by side — not just the numbers.
      </p>
      <div className="flex gap-3.5">
        <PhotoCol
          record={left}
          onPrev={() => setLeftIdx((i) => Math.max(0, i - 1))}
          onNext={() => setLeftIdx((i) => Math.min(rightIdx, i + 1))}
          prevDisabled={leftIdx === 0}
          nextDisabled={leftIdx >= rightIdx}
        />
        <PhotoCol
          record={right}
          onPrev={() => setRightIdx((i) => Math.max(leftIdx, i - 1))}
          onNext={() => setRightIdx((i) => Math.min(withPhotos.length - 1, i + 1))}
          prevDisabled={rightIdx <= leftIdx}
          nextDisabled={rightIdx === withPhotos.length - 1}
        />
      </div>
      <div
        className="rounded-xl border border-dashed px-3 py-2.5 text-sm text-center"
        style={{ borderColor: "var(--rule)", color: "var(--ink-soft)" }}
      >
        The numbers tell you it&apos;s improving; the pages show you how.
      </div>
    </div>
  );
}

function Header({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex items-center justify-between gap-2.5 mb-1.5">
      <button
        type="button"
        onClick={onClose}
        className="w-9 h-9 rounded-full border text-base transition-transform hover:bg-[var(--paper-3)] active:scale-90"
        style={{ background: "var(--paper-2)", borderColor: "var(--rule)", color: "var(--ink-soft)" }}
      >
        ✕
      </button>
      <span
        className="text-xs uppercase tracking-wide rounded-full border px-3 py-1.5"
        style={{ background: "var(--paper-2)", borderColor: "var(--rule)", color: "var(--ink-soft)" }}
      >
        Progress photos
      </span>
      <span className="w-9" />
    </div>
  );
}

function PhotoCol({
  record,
  onPrev,
  onNext,
  prevDisabled,
  nextDisabled,
}: {
  record: SessionRecord;
  onPrev: () => void;
  onNext: () => void;
  prevDisabled: boolean;
  nextDisabled: boolean;
}) {
  return (
    <div className="flex-1 flex flex-col gap-1.5 min-w-0">
      <div className="text-[11px] font-bold uppercase tracking-wide" style={{ color: "var(--ink-faint)" }}>
        {record.date} {record.seq > 1 ? `#${record.seq}` : ""}
      </div>
      <div className="w-full aspect-[3/4] rounded-xl border overflow-hidden" style={{ borderColor: "var(--rule)", background: "var(--paper-3)" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={record.photo!.src}
          alt=""
          className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
        />
      </div>
      <div className="flex gap-1.5 flex-wrap">
        {record.wpm != null && <Chip>{record.wpm} wpm</Chip>}
        {record.legibility?.score != null && <Chip>legible {record.legibility.score}/5</Chip>}
        {record.accuracy?.score != null && <Chip>accurate {record.accuracy.score}/5</Chip>}
      </div>
      <div className="flex justify-between gap-1.5">
        <button
          type="button"
          disabled={prevDisabled}
          onClick={onPrev}
          className="rounded-lg border text-xs px-2.5 py-1 disabled:opacity-40 transition-transform enabled:hover:bg-[var(--paper-3)] enabled:active:scale-90"
          style={{ borderColor: "var(--rule)" }}
        >
          ←
        </button>
        <button
          type="button"
          disabled={nextDisabled}
          onClick={onNext}
          className="rounded-lg border text-xs px-2.5 py-1 disabled:opacity-40 transition-transform enabled:hover:bg-[var(--paper-3)] enabled:active:scale-90"
          style={{ borderColor: "var(--rule)" }}
        >
          →
        </button>
      </div>
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="font-mono-ink text-[10.5px] font-semibold rounded-full px-2 py-0.5"
      style={{ background: "var(--paper-3)", color: "var(--ink-soft)" }}
    >
      {children}
    </span>
  );
}
