"use client";

import { useEffect, useState } from "react";

// A playful "work is underway" animation for the review's pending state,
// styled after GitHub's check-run list: items resolve to a checkmark one at
// a time, in order, staying checked — then once all are checked, pause and
// reset. This is decorative (showing activity), not a literal progress
// tracker — the real review is a single opaque AI call with no sub-steps to
// actually report.
//
// An earlier version tried to fake this with phase-shifted CSS keyframes
// (same animation, staggered animation-delay per row) — it looked random:
// each row's "checked" state was a brief ~1s pulse tied to its own local
// keyframe percentage, not held until a shared reset point, so items
// flicked between checked and spinning independently instead of staying
// resolved in sequence. Explicit step state fixes that directly.
const ITEMS = ["Reading the ink", "Checking the letters", "Comparing the words"];
const STEP_MS = 900; // time each item spends as the active spinner before resolving
const HOLD_MS = 700; // pause with everything checked before the cascade resets

export function WritingLoader() {
  // 0..ITEMS.length-1 = that item is the active spinner (earlier items are
  // already checked); ITEMS.length = all checked, holding before reset.
  const [step, setStep] = useState(0);

  useEffect(() => {
    const delay = step === ITEMS.length ? HOLD_MS : STEP_MS;
    const id = setTimeout(() => setStep((s) => (s + 1) % (ITEMS.length + 1)), delay);
    return () => clearTimeout(id);
  }, [step]);

  return (
    <div className="flex flex-col gap-2 w-full max-w-[220px]">
      {ITEMS.map((label, i) => {
        const checked = step === ITEMS.length || i < step;
        const active = i === step;
        return (
          <div key={label} className="flex items-center gap-2.5">
            <span className="relative w-4 h-4 flex-none">
              {checked ? (
                <svg viewBox="0 0 16 16" className="absolute inset-0">
                  <circle cx="8" cy="8" r="7" fill="var(--good)" />
                  <path d="M4.5 8.2 L6.8 10.6 L11.5 5.4" fill="none" stroke="var(--paper)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : active ? (
                <svg viewBox="0 0 16 16" className="absolute inset-0" style={{ animation: "wl-spin 0.8s linear infinite" }}>
                  <circle cx="8" cy="8" r="6" fill="none" stroke="var(--gold)" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="22 100" />
                </svg>
              ) : (
                <svg viewBox="0 0 16 16" className="absolute inset-0">
                  <circle cx="8" cy="8" r="6" fill="none" stroke="var(--rule)" strokeWidth="2.5" />
                </svg>
              )}
            </span>
            <span className="text-xs" style={{ color: checked || active ? "var(--ink-soft)" : "var(--ink-faint)" }}>
              {label}
            </span>
          </div>
        );
      })}
      <style>{`
        @keyframes wl-spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
