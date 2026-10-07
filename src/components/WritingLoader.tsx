"use client";

import { useEffect, useState } from "react";

// Modeled directly on Claude Code's own CLI "thinking" indicator: a fast
// braille-pattern spinner glyph, a status word that cycles, and the elapsed
// time — all on one line. Decorative (there are no real sub-steps to
// report, just one opaque AI call), but the visual language is the same.
const PHRASES = ["Reading the ink", "Checking the letters", "Comparing the words"];
const PHRASE_MS = 1800;
const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
const SPINNER_MS = 80;

export function WritingLoader({ seconds }: { seconds?: number }) {
  const [phraseIdx, setPhraseIdx] = useState(0);
  const [spinnerIdx, setSpinnerIdx] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setPhraseIdx((i) => (i + 1) % PHRASES.length), PHRASE_MS);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const id = setInterval(() => setSpinnerIdx((i) => (i + 1) % SPINNER_FRAMES.length), SPINNER_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex items-center gap-2">
      <span className="font-mono-ink text-base leading-none flex-none w-4 text-center" style={{ color: "var(--accent)" }}>
        {SPINNER_FRAMES[spinnerIdx]}
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
