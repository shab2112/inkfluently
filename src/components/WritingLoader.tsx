"use client";

// A playful "work is underway" animation for the review's pending state,
// styled after GitHub's check-run list: each row shows a spinner, then
// resolves to a green checkmark, in sequence — looping continuously since
// this is decorative (showing activity), not a literal progress tracker;
// the real review is a single opaque AI call with no sub-steps to report.
// Pure CSS keyframes + staggered animation-delay, no JS timer/interval.
const ITEMS = ["Reading the ink", "Checking the letters", "Comparing the words"];
const STEP_SEC = 1.5;
const TOTAL_SEC = ITEMS.length * STEP_SEC;

export function WritingLoader() {
  return (
    <div className="flex flex-col gap-2 w-full max-w-[220px]">
      {ITEMS.map((label, i) => (
        <div key={label} className="flex items-center gap-2.5">
          <span className="relative w-4 h-4 flex-none">
            <svg
              viewBox="0 0 16 16"
              className="absolute inset-0"
              style={{
                animation: `wl-spin 0.8s linear infinite, wl-fade-out ${TOTAL_SEC}s linear infinite`,
                animationDelay: `0s, ${i * STEP_SEC}s`,
              }}
            >
              <circle
                cx="8"
                cy="8"
                r="6"
                fill="none"
                stroke="var(--gold)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeDasharray="22 100"
              />
            </svg>
            <svg
              viewBox="0 0 16 16"
              className="absolute inset-0"
              style={{ animation: `wl-fade-in ${TOTAL_SEC}s linear infinite`, animationDelay: `${i * STEP_SEC}s` }}
            >
              <circle cx="8" cy="8" r="7" fill="var(--good)" />
              <path d="M4.5 8.2 L6.8 10.6 L11.5 5.4" fill="none" stroke="var(--paper)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <span className="text-xs" style={{ color: "var(--ink-soft)" }}>
            {label}
          </span>
        </div>
      ))}
      <style>{`
        @keyframes wl-spin { to { transform: rotate(360deg); } }
        @keyframes wl-fade-out {
          0% { opacity: 1; }
          65% { opacity: 1; }
          72% { opacity: 0; }
          95% { opacity: 0; }
          100% { opacity: 1; }
        }
        @keyframes wl-fade-in {
          0% { opacity: 0; transform: scale(0.6); }
          65% { opacity: 0; transform: scale(0.6); }
          72% { opacity: 1; transform: scale(1); }
          95% { opacity: 1; transform: scale(1); }
          100% { opacity: 0; transform: scale(0.6); }
        }
      `}</style>
    </div>
  );
}
