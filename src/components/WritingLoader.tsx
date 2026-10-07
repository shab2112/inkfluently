"use client";

import { useEffect, useState } from "react";

// A playful "work is underway" animation for the review's pending state: a
// single status line that cycles through phases (not three parallel rows —
// this is decorative, there are no real sub-steps to report, just one opaque
// AI call), with the elapsed time on the same line and a pulsing "live"
// bullet marker alongside it.
const PHRASES = ["Reading the ink", "Checking the letters", "Comparing the words"];
const PHRASE_MS = 1800;

export function WritingLoader({ seconds }: { seconds?: number }) {
  const [phraseIdx, setPhraseIdx] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setPhraseIdx((i) => (i + 1) % PHRASES.length), PHRASE_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex items-center gap-2">
      <span className="relative flex w-2.5 h-2.5 flex-none">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60" style={{ background: "var(--accent)" }} />
        <span className="relative inline-flex rounded-full w-2.5 h-2.5" style={{ background: "var(--accent)" }} />
      </span>
      <span key={phraseIdx} className="text-xs" style={{ color: "var(--ink-soft)", animation: "wl-line-in 0.3s ease" }}>
        {PHRASES[phraseIdx]}
        {seconds != null && <span style={{ color: "var(--ink-faint)" }}> · {seconds}s</span>}
      </span>
      <style>{`
        @keyframes wl-line-in {
          from { opacity: 0; transform: translateY(3px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
