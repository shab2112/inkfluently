"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Settings } from "@/components/InkfluentlyApp";
import type { Passage } from "@/lib/types";
import { buildPhrases, punctuationCue, speakableVersion, splitCustom } from "@/lib/phrasing";
import { todayStr } from "@/lib/dates";
import type { useVoice } from "@/lib/useVoice";

export type FinishDraft = {
  date: string;
  elapsedSec: number;
  wordCount: number;
  topic: string;
  passageText: string;
};

function fmtClock(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s < 10 ? "0" : ""}${s}`;
}

export function PracticeView({
  settings,
  passage,
  useCustom,
  customText,
  voice,
  onExit,
  onFinish,
}: {
  settings: Settings;
  passage: Passage;
  useCustom: boolean;
  customText: string;
  voice: ReturnType<typeof useVoice>;
  onExit: () => void;
  onFinish: (draft: FinishDraft) => void;
}) {
  const sentences = useMemo(
    () => (useCustom && customText.trim() ? splitCustom(customText) : passage.sentences),
    [useCustom, customText, passage]
  );
  const topic = useCustom && customText.trim() ? "Your own passage" : passage.topic;
  const phrases = useMemo(() => buildPhrases(sentences), [sentences]);
  const wordCount = useMemo(
    () => sentences.join(" ").trim().split(/\s+/).filter(Boolean).length,
    [sentences]
  );

  const [idx, setIdx] = useState(-1);
  const [rate, setRate] = useState(1);
  const [elapsed, setElapsed] = useState(0);
  const [phrasePlayedOnce, setPhrasePlayedOnce] = useState(false);
  const [lastVoiceLabel, setLastVoiceLabel] = useState("");
  const startedAtRef = useRef<number>(0);

  useEffect(() => {
    startedAtRef.current = Date.now();
    const id = setInterval(() => {
      setElapsed(Math.round((Date.now() - startedAtRef.current) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const targetSec = settings.targetMin * 60;
  const over = elapsed >= targetSec;
  const pct = Math.min(1, elapsed / targetSec);
  const radius = 76;
  const circumference = 2 * Math.PI * radius;

  const currentPhrase = idx >= 0 ? phrases[idx] : null;
  const isLast = idx === phrases.length - 1;
  const sentenceIdx = currentPhrase ? currentPhrase.sentenceIdx : 0;
  const cue = currentPhrase ? punctuationCue(currentPhrase.text) : null;

  function speakPhrase(i: number) {
    const p = phrases[i];
    if (!p) return;
    const text = speakableVersion(p.text, settings.punct);
    const chosen = voice.speak(text, rate);
    setLastVoiceLabel(chosen ? chosen.name : "browser default");
  }

  function handlePlay() {
    const next = idx === -1 ? 0 : idx;
    setIdx(next);
    speakPhrase(next);
    setPhrasePlayedOnce(true);
  }

  function handleNext() {
    if (idx < phrases.length - 1) {
      const next = idx + 1;
      setIdx(next);
      setPhrasePlayedOnce(false);
      speakPhrase(next);
      setPhrasePlayedOnce(true);
    }
  }

  function handleFinish() {
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    onFinish({ date: todayStr(), elapsedSec: elapsed, wordCount, topic, passageText: sentences.join(" ") });
  }

  return (
    <div className="fixed inset-0 flex flex-col px-5 pt-5 pb-5 overflow-y-auto" style={{ background: "var(--paper)" }}>
      <div className="flex items-center justify-between gap-2.5">
        <button
          type="button"
          onClick={onExit}
          className="w-9 h-9 rounded-full border text-base flex-none"
          style={{ background: "var(--paper-2)", borderColor: "var(--rule)", color: "var(--ink-soft)" }}
        >
          ✕
        </button>
        <span
          className="text-xs uppercase tracking-wide rounded-full border px-3 py-1.5"
          style={{ background: "var(--paper-2)", borderColor: "var(--rule)", color: "var(--ink-soft)" }}
        >
          {topic}
        </span>
        <span className="w-9" />
      </div>

      <div className="flex justify-center my-6">
        <div className="relative w-[172px] h-[172px]">
          <svg viewBox="0 0 172 172" className="w-full h-full -rotate-90">
            <circle cx="86" cy="86" r={radius} fill="none" stroke="var(--paper-3)" strokeWidth={10} />
            <circle
              cx="86"
              cy="86"
              r={radius}
              fill="none"
              stroke={over ? "var(--gold)" : "var(--accent)"}
              strokeWidth={10}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - pct)}
              style={{ transition: "stroke-dashoffset .3s linear" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="font-mono-ink text-3xl">{fmtClock(Math.max(0, targetSec - elapsed))}</div>
            <div className="text-[11px] uppercase tracking-wide" style={{ color: "var(--ink-soft)" }}>
              remaining
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-center gap-1.5 flex-wrap mb-1 mt-4">
        {phrases.map((p, i) => (
          <i
            key={i}
            className="w-2.5 h-2.5 rounded-full block border"
            style={{
              marginRight: i < phrases.length - 1 && phrases[i + 1].sentenceIdx !== p.sentenceIdx ? "8px" : undefined,
              background: i < idx ? "var(--good)" : i === idx ? "var(--accent)" : "var(--paper-3)",
              borderColor: i < idx ? "var(--good)" : i === idx ? "var(--accent)" : "var(--rule)",
              transform: i === idx ? "scale(1.25)" : undefined,
            }}
          />
        ))}
      </div>

      {over && (
        <div
          className="rounded-xl px-3.5 py-2.5 text-sm font-semibold text-center mb-1.5"
          style={{ background: "var(--gold-soft)", color: "var(--gold)" }}
        >
          ⏰ Time&apos;s up — nothing advances automatically. Finish this sentence, then tap <b>Finish</b> yourself whenever you&apos;re ready.
        </div>
      )}

      <div className="flex-1 flex items-center justify-center text-center px-1.5 py-4 min-h-[110px]">
        <div className="text-sm max-w-[340px]" style={{ color: "var(--ink-faint)" }}>
          {idx === -1 ? (
            <>Press <b style={{ color: "var(--ink-soft)" }}>Play</b> to begin — it reads a few words at a time, like a real dictée.</>
          ) : isLast ? (
            <>Last part (sentence <b style={{ color: "var(--ink-soft)" }}>{sentenceIdx + 1} of {sentences.length}</b>) — listen, then press <b style={{ color: "var(--ink-soft)" }}>Finish</b> when your writing is done.</>
          ) : (
            <>Sentence <b style={{ color: "var(--ink-soft)" }}>{sentenceIdx + 1} of {sentences.length}</b> — listen, then write.</>
          )}
        </div>
      </div>

      <div className="flex justify-center gap-2 mb-3.5">
        {[0.8, 1].map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRate(r)}
            className="rounded-full border px-3.5 py-1.5 text-xs font-semibold"
            style={
              rate === r
                ? { borderColor: "var(--accent)", color: "var(--accent)", background: "var(--accent-soft)" }
                : { borderColor: "var(--rule)", background: "var(--paper-2)", color: "var(--ink-soft)" }
            }
          >
            {r === 0.8 ? "🐢 Slow" : "🙂 Normal"}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2.5 pb-1.5">
        <button
          type="button"
          onClick={handlePlay}
          className="rounded-xl py-3.5 text-[15px] font-bold w-full"
          style={{ background: "var(--ink)", color: "var(--paper)" }}
        >
          {idx === -1 || !phrasePlayedOnce ? "▶ Play" : "🔁 Repeat"}
        </button>
        {cue && phrasePlayedOnce && (
          <span
            className="text-[11px] font-semibold text-center rounded-full py-1.5"
            style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
          >
            {cue}
          </span>
        )}
        {lastVoiceLabel && (
          <span className="text-[11px] text-center" style={{ color: "var(--ink-faint)" }}>
            🔊 {lastVoiceLabel}
          </span>
        )}
        <button
          type="button"
          disabled={isLast || idx === -1}
          onClick={handleNext}
          className="rounded-xl py-3.5 text-[15px] font-bold w-full border disabled:opacity-45"
          style={{ background: "var(--paper-3)", borderColor: "var(--rule)" }}
        >
          {isLast ? "That's everything" : "Next →"}
        </button>
        <button
          type="button"
          onClick={handleFinish}
          className="rounded-xl py-3.5 text-[15px] font-bold w-full"
          style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
        >
          ✓ Finish &amp; take a photo
        </button>
      </div>
    </div>
  );
}
