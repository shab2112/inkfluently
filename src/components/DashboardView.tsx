"use client";

import { LineChart } from "@/components/LineChart";
import type { SessionRecord } from "@/lib/types";

export function DashboardView({ history, onClose }: { history: SessionRecord[]; onClose: () => void }) {
  const chronological = history
    .slice()
    .sort((a, b) => (a.date !== b.date ? (a.date < b.date ? -1 : 1) : (a.seq || 1) - (b.seq || 1)));

  const wpmPoints = chronological
    .filter((h) => h.wpm != null)
    .map((h) => ({ label: `${h.date}#${h.seq}`, value: h.wpm as number }));
  const legPoints = chronological
    .filter((h) => h.legibility?.score != null)
    .map((h) => ({ label: `${h.date}#${h.seq}`, value: h.legibility!.score }));
  const accPoints = chronological
    .filter((h) => h.accuracy?.score != null)
    .map((h) => ({ label: `${h.date}#${h.seq}`, value: h.accuracy!.score }));

  return (
    <div className="max-w-2xl mx-auto px-4 py-7 pb-16 flex flex-col gap-4">
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
          Trends
        </span>
        <span className="w-9" />
      </div>
      <h2 className="text-[22px] font-bold">Progress over time</h2>

      <ChartCard title="Speed (words per minute)" color="var(--series-speed, #eb6834)">
        <LineChart points={wpmPoints} color="var(--series-speed, #eb6834)" unit=" wpm" />
      </ChartCard>
      <ChartCard title="Legibility" color="var(--series-legibility, #2a78d6)">
        <LineChart points={legPoints} color="var(--series-legibility, #2a78d6)" unit="/5" />
      </ChartCard>
      <ChartCard title="Accuracy (secondary)" color="var(--series-accuracy, #1baf7a)">
        <LineChart points={accPoints} color="var(--series-accuracy, #1baf7a)" unit="/5" />
      </ChartCard>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; color: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border p-4" style={{ background: "var(--paper-2)", borderColor: "var(--rule)" }}>
      <h3 className="text-sm font-bold mb-2">{title}</h3>
      {children}
    </div>
  );
}
