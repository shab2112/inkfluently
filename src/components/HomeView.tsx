"use client";

import { useState } from "react";
import type { Settings } from "@/components/InkfluentlyApp";
import type { SessionRecord, WeeklyFocus, Passage, PassageSkill } from "@/lib/types";
import { SKILL_NAMES } from "@/lib/passages";
import { dateStrOffset } from "@/lib/dates";
import type { useVoice } from "@/lib/useVoice";

export function HomeView({
  settings,
  setSettings,
  history,
  onDeleteSession,
  streak,
  weeklyFocus,
  currentPassage,
  adaptiveTag,
  adaptiveSkill,
  onShuffle,
  useCustom,
  setUseCustom,
  customText,
  setCustomText,
  storageWarning,
  voice,
  onStart,
  onOpenDashboard,
  onOpenProgress,
}: {
  settings: Settings;
  setSettings: (s: Settings | ((prev: Settings) => Settings)) => void;
  history: SessionRecord[];
  onDeleteSession: (date: string, seq: number) => void;
  streak: { current: number; best: number };
  weeklyFocus: WeeklyFocus | null;
  currentPassage: Passage;
  adaptiveTag: PassageSkill;
  adaptiveSkill: PassageSkill | null;
  onShuffle: () => void;
  useCustom: boolean;
  setUseCustom: (v: boolean) => void;
  customText: string;
  setCustomText: (v: string) => void;
  storageWarning: boolean;
  voice: ReturnType<typeof useVoice>;
  onStart: () => void;
  onOpenDashboard: () => void;
  onOpenProgress: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const doneDates: Record<string, boolean> = {};
  history.forEach((h) => (doneDates[h.date] = true));
  const heatDays = Array.from({ length: 28 }, (_, i) => 27 - i).map((i) => dateStrOffset(-i));

  const sortedLog = history
    .slice()
    .sort((a, b) => (a.date !== b.date ? (a.date < b.date ? 1 : -1) : (b.seq || 1) - (a.seq || 1)));

  const canStart = useCustom ? customText.trim().length > 0 : true;

  return (
    <div className="max-w-2xl mx-auto px-4 py-7 pb-16 flex flex-col gap-5">
      <div className="flex items-baseline justify-between gap-2 flex-wrap">
        <h1 className="text-2xl font-bold tracking-tight">
          Ink<em className="not-italic" style={{ color: "var(--accent)" }}>fluently</em>
        </h1>
        <span className="text-sm" style={{ color: "var(--ink-soft)" }}>
          {settings.name ? `Hi, ${settings.name}` : "Hi there"}
        </span>
      </div>

      <div
        className="rounded-2xl p-5 flex items-center gap-5 border"
        style={{ background: "var(--paper-2)", borderColor: "var(--rule)" }}
      >
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center text-3xl flex-none"
          style={{ background: "var(--gold-soft)" }}
        >
          🔥
        </div>
        <div className="flex gap-6 flex-wrap">
          <Stat label="Day streak" value={streak.current} />
          <Stat label="Best streak" value={streak.best} />
          <Stat label="Total sessions" value={history.length} />
        </div>
      </div>

      <div className="flex gap-2.5 flex-wrap">
        <button
          type="button"
          onClick={onOpenDashboard}
          className="rounded-full border px-3.5 py-2 text-sm font-semibold"
          style={{ background: "var(--paper-2)", borderColor: "var(--rule)" }}
        >
          📊 View trends
        </button>
        <button
          type="button"
          onClick={onOpenProgress}
          className="rounded-full border px-3.5 py-2 text-sm font-semibold"
          style={{ background: "var(--paper-2)", borderColor: "var(--rule)" }}
        >
          🖼️ Before &amp; after
        </button>
      </div>

      {weeklyFocus && (
        <div
          className="rounded-2xl p-3.5 border flex flex-col gap-0.5"
          style={{ background: "var(--accent-soft)", borderColor: "var(--accent)" }}
        >
          <div
            className="text-[10.5px] font-bold uppercase tracking-wide"
            style={{ color: "var(--accent)" }}
          >
            🎯 This week&apos;s focus
          </div>
          <div className="text-sm">{weeklyFocus.tip}</div>
        </div>
      )}

      <div className="rounded-2xl p-5 border" style={{ background: "var(--paper-2)", borderColor: "var(--rule)" }}>
        <h2 className="text-lg font-bold mb-1">Start today&apos;s practice</h2>
        {adaptiveSkill && adaptiveSkill === adaptiveTag && (
          <div className="text-sm mb-2" style={{ color: "var(--ink-soft)" }}>
            Today&apos;s passage: extra {SKILL_NAMES[adaptiveSkill]}.
          </div>
        )}
        <p className="text-sm mb-4" style={{ color: "var(--ink-soft)" }}>
          Pick a length, then press play — a passage will be read aloud for you to write.
        </p>

        <div className="flex flex-col gap-3.5">
          <div className="flex rounded-xl p-1 gap-1" style={{ background: "var(--paper-3)" }}>
            {[10, 12, 15].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setSettings((s) => ({ ...s, targetMin: m }))}
                className="flex-1 rounded-lg py-2 text-sm font-semibold"
                style={
                  settings.targetMin === m
                    ? { background: "var(--paper)", boxShadow: "0 1px 2px rgba(0,0,0,0.06)" }
                    : { color: "var(--ink-soft)" }
                }
              >
                {m} min
              </button>
            ))}
          </div>

          <div
            className="rounded-xl border border-dashed px-3 py-2.5 flex items-center justify-between gap-2.5 text-sm"
            style={{ borderColor: "var(--rule)", color: "var(--ink-soft)" }}
          >
            <span>Topic: {currentPassage.topic}</span>
            <button type="button" onClick={onShuffle} className="font-semibold" style={{ color: "var(--accent)" }}>
              🔀 Shuffle
            </button>
          </div>

          <ToggleRow
            label="✏️ Use my own passage instead"
            on={useCustom}
            onToggle={() => setUseCustom(!useCustom)}
          />
          {useCustom && (
            <textarea
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              placeholder="Paste or type the passage you want read aloud…"
              className="w-full min-h-[88px] rounded-lg border px-3 py-2.5 text-sm"
              style={{ background: "var(--paper)", borderColor: "var(--rule)" }}
            />
          )}

          <ToggleRow
            label="🔤 Announce punctuation (classic dictée style)"
            on={settings.punct}
            onToggle={() => setSettings((s) => ({ ...s, punct: !s.punct }))}
          />

          {voice.voices.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-sm font-semibold">🗣️ Reading voice</span>
              <select
                value={voice.voiceURI ?? ""}
                onChange={(e) => voice.setVoiceURI(e.target.value)}
                className="w-full rounded-lg border px-3 py-2.5 text-sm"
                style={{ background: "var(--paper)", borderColor: "var(--rule)" }}
              >
                {voice.voices.map((v) => (
                  <option key={v.voiceURI} value={v.voiceURI}>
                    {v.name} ({v.lang})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <span className="text-sm font-semibold">Writer&apos;s age (used to tailor AI feedback tone)</span>
            <input
              type="number"
              min={4}
              max={99}
              value={settings.userAge ?? ""}
              onChange={(e) =>
                setSettings((s) => ({ ...s, userAge: e.target.value ? parseInt(e.target.value, 10) : null }))
              }
              placeholder="e.g. 16"
              className="w-full rounded-lg border px-3 py-2.5 text-sm"
              style={{ background: "var(--paper)", borderColor: "var(--rule)" }}
            />
          </div>

          <div className="flex items-center gap-2.5">
            <span className="text-sm flex-1" style={{ color: "var(--ink-soft)" }}>
              Sessions per day (target)
            </span>
            <button
              type="button"
              aria-label="Decrease sessions-per-day target"
              onClick={() => setSettings((s) => ({ ...s, sessionsPerDayTarget: Math.max(1, s.sessionsPerDayTarget - 1) }))}
              className="w-8 h-8 rounded-lg border font-bold"
              style={{ borderColor: "var(--rule)", background: "var(--paper-3)" }}
            >
              −
            </button>
            <span className="font-mono-ink text-sm min-w-[28px] text-center">{settings.sessionsPerDayTarget}</span>
            <button
              type="button"
              aria-label="Increase sessions-per-day target"
              onClick={() => setSettings((s) => ({ ...s, sessionsPerDayTarget: Math.min(5, s.sessionsPerDayTarget + 1) }))}
              className="w-8 h-8 rounded-lg border font-bold"
              style={{ borderColor: "var(--rule)", background: "var(--paper-3)" }}
            >
              +
            </button>
          </div>

          <button
            type="button"
            disabled={!canStart}
            onClick={onStart}
            className="rounded-xl py-3.5 text-[15px] font-bold w-full disabled:opacity-45"
            style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
          >
            ▶ Start practice
          </button>
        </div>
      </div>

      <div className="rounded-2xl p-5 border" style={{ background: "var(--paper-2)", borderColor: "var(--rule)" }}>
        <h2 className="text-lg font-bold mb-3.5">Practice log</h2>
        <div className="grid grid-cols-[repeat(14,1fr)] gap-1.5 mb-4">
          {heatDays.map((ds) => (
            <i
              key={ds}
              className="aspect-square rounded block border"
              style={
                doneDates[ds]
                  ? { background: "var(--good)", borderColor: "var(--good)" }
                  : { background: "var(--paper-3)", borderColor: "var(--rule)" }
              }
              title={ds}
            />
          ))}
        </div>
        <div className="flex flex-col gap-2.5">
          {sortedLog.length === 0 && (
            <div className="text-sm py-2.5" style={{ color: "var(--ink-faint)" }}>
              No sessions yet — start your first practice above.
            </div>
          )}
          {sortedLog.map((h) => {
            const key = `${h.date}_${h.seq}`;
            return (
              <div
                key={key}
                className="flex items-center gap-3 p-2.5 rounded-xl border"
                style={{ background: "var(--paper)", borderColor: "var(--rule)" }}
              >
                {h.photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={h.photo.src} alt="" className="w-12 h-12 rounded-lg object-cover flex-none border" style={{ borderColor: "var(--rule)" }} />
                ) : (
                  <div className="w-12 h-12 rounded-lg flex items-center justify-center flex-none border" style={{ background: "var(--paper-3)", borderColor: "var(--rule)" }}>
                    📝
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold">
                    {h.date} {h.seq > 1 ? `· #${h.seq}` : ""}
                  </div>
                  <div className="text-xs truncate" style={{ color: "var(--ink-soft)" }}>
                    {h.topic} {h.wpm ? `· ${h.wpm} wpm` : ""} {h.legibility?.score ? `· legible ${h.legibility.score}/5` : ""}
                  </div>
                </div>
                {confirmDelete === key ? (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      className="text-xs font-bold rounded-md border px-2 py-1"
                      style={{ color: "var(--danger)", borderColor: "var(--danger)" }}
                      onClick={() => {
                        onDeleteSession(h.date, h.seq);
                        setConfirmDelete(null);
                      }}
                    >
                      Delete
                    </button>
                    <button
                      type="button"
                      className="text-xs font-bold rounded-md border px-2 py-1"
                      style={{ borderColor: "var(--rule)" }}
                      onClick={() => setConfirmDelete(null)}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    aria-label="Delete session"
                    className="text-base px-1.5 py-1 rounded-md flex-none"
                    style={{ color: "var(--ink-faint)" }}
                    onClick={() => setConfirmDelete(key)}
                  >
                    ✕
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {storageWarning && (
        <div
          className="text-sm rounded-xl border px-3.5 py-2.5"
          style={{ color: "var(--danger)", background: "var(--accent-soft)", borderColor: "var(--danger)" }}
        >
          ⚠️ This browser is blocking on-device storage — sessions may not be saved reliably here.
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="font-serif-brand text-3xl font-bold">{value}</div>
      <div className="text-xs uppercase tracking-wide" style={{ color: "var(--ink-soft)" }}>
        {label}
      </div>
    </div>
  );
}

function ToggleRow({ label, on, onToggle }: { label: string; on: boolean; onToggle: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        onClick={onToggle}
        className="w-[42px] h-6 rounded-full relative flex-none border"
        style={{
          background: on ? "var(--accent-soft)" : "var(--paper-3)",
          borderColor: on ? "var(--accent)" : "var(--rule)",
        }}
      >
        <span
          className="absolute top-0.5 w-[18px] h-[18px] rounded-full transition-transform"
          style={{
            left: "2px",
            background: on ? "var(--accent)" : "var(--ink-faint)",
            transform: on ? "translateX(18px)" : "translateX(0)",
          }}
        />
      </button>
    </div>
  );
}
