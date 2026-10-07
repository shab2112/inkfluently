"use client";

import { useState } from "react";

type Fact = {
  headline: string;
  body: string;
  citation: string;
};

// Grounded in real, named, checkable research — same standard as the Ayres
// 1912 study already backing the legibility-review prompt (src/lib/gemini.ts).
// Deliberately includes the nuanced finding (recovery by second grade), not
// just the scary first half of it — overstating the decline would be exactly
// the kind of overclaiming this app has avoided elsewhere (see the page-crop
// privacy copy fix).
const FACTS: Fact[] = [
  {
    headline: "Pandemic schooling really did set kids back on handwriting specifically",
    body:
      "A large Norwegian study found first-graders who went through about seven weeks of emergency remote instruction wrote less fluently and rated their own writing lower than first-graders at the same schools the year before the pandemic.",
    citation: "Skar, Graham & Huebner (2022), Journal of Educational Psychology",
  },
  {
    headline: "The encouraging part: that gap mostly closed within a year",
    body:
      "A follow-up on the same students found the handwriting-fluency and writing-quality gap was no longer statistically meaningful by second grade, once normal schooling and regular practice resumed — consistent practice is what closed it, not time alone.",
    citation: "Skar, Graham & Huebner (2023), Educational Psychology Review",
  },
  {
    headline: "Writing by hand engages the brain differently than typing or tracing",
    body:
      "In brain-imaging studies, children who freehand-wrote letters showed activity in reading-related brain regions that children who typed or traced the same letters did not.",
    citation: "James et al., child handwriting/fMRI research (Indiana University)",
  },
];

export function WhyItMatters() {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-2xl border p-4" style={{ background: "var(--paper-2)", borderColor: "var(--rule)" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2.5 text-left transition-colors"
      >
        <span className="text-sm font-bold">📚 Why daily practice matters</span>
        <span
          className="text-xs rounded-full border px-2 py-1 font-semibold transition-transform flex-none"
          style={{ borderColor: "var(--rule)", color: "var(--ink-soft)", transform: open ? "rotate(180deg)" : "none" }}
        >
          ▾
        </span>
      </button>

      {open && (
        <div className="flex flex-col gap-3 mt-3.5">
          {FACTS.map((fact) => (
            <div key={fact.headline} className="rounded-xl p-3" style={{ background: "var(--paper)" }}>
              <div className="text-sm font-semibold">{fact.headline}</div>
              <div className="text-xs mt-1 leading-snug" style={{ color: "var(--ink-soft)" }}>
                {fact.body}
              </div>
              <div className="text-[10.5px] mt-1.5 font-semibold uppercase tracking-wide" style={{ color: "var(--ink-faint)" }}>
                {fact.citation}
              </div>
            </div>
          ))}
          <div className="text-[11px]" style={{ color: "var(--ink-faint)" }}>
            These findings are about writing practice and pandemic-era schooling in general — not a claim that this
            app specifically has been studied.
          </div>
        </div>
      )}
    </div>
  );
}
