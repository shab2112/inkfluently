"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { lsGet, lsSet, isLocalStorageAvailable } from "@/lib/storage";
import { PASSAGES, PASSAGE_SKILL_FOR_DIM, pickPassage, passageSkillTag } from "@/lib/passages";
import { computeStreak, computeWeeklyFocus } from "@/lib/history";
import { dataUrlToFile } from "@/lib/pageCrop";
import { useVoice } from "@/lib/useVoice";
import type { Passage, SessionRecord } from "@/lib/types";
import { HomeView } from "@/components/HomeView";
import { PracticeView, type FinishDraft } from "@/components/PracticeView";
import { FinishView } from "@/components/FinishView";
import { DashboardView } from "@/components/DashboardView";
import { ProgressView } from "@/components/ProgressView";

type View = "home" | "practice" | "finish" | "dashboard" | "progress";

export type Settings = {
  name: string;
  targetMin: number;
  punct: boolean;
  userAge: number | null;
  sessionsPerDayTarget: number;
};

const DEFAULT_SETTINGS: Settings = {
  name: "",
  targetMin: 12,
  punct: false,
  userAge: null,
  sessionsPerDayTarget: 1,
};

export default function InkfluentlyApp() {
  const [mounted, setMounted] = useState(false);
  const [view, setView] = useState<View>("home");
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [history, setHistory] = useState<SessionRecord[]>([]);
  const [deck, setDeck] = useState<string[]>([]);
  const [currentPassage, setCurrentPassage] = useState<Passage>(PASSAGES[0]);
  const [useCustom, setUseCustom] = useState(false);
  const [customText, setCustomText] = useState("");
  const [storageWarning, setStorageWarning] = useState(false);
  const [finishDraft, setFinishDraft] = useState<FinishDraft | null>(null);
  const voice = useVoice();

  // ---- Hydrate from localStorage on mount (client-only, avoids SSR mismatch) ----
  // One-time hydration from an external store (localStorage), not state derived
  // from props/state — intentionally not a lazy useState initializer, since this
  // component also renders server-side where localStorage doesn't exist.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setStorageWarning(!isLocalStorageAvailable());
    setSettings({
      name: lsGet("ink_name", ""),
      targetMin: lsGet("ink_targetMin", 12),
      punct: lsGet("ink_punct", false),
      userAge: lsGet("ink_userAge", null),
      sessionsPerDayTarget: lsGet("ink_sessionsPerDay", 1),
    });
    const loadedHistory = lsGet<SessionRecord[]>("ink_history", []);
    setHistory(loadedHistory);
    const loadedDeck = lsGet<string[]>("ink_deck", []);
    const focus = computeWeeklyFocus(loadedHistory);
    const skill = focus ? PASSAGE_SKILL_FOR_DIM[focus.name] : null;
    const { passage, deck: nextDeck } = pickPassage(loadedDeck, skill);
    setCurrentPassage(passage);
    setDeck(nextDeck);
    lsSet("ink_deck", nextDeck);
    setMounted(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!mounted) return;
    lsSet("ink_name", settings.name);
    lsSet("ink_targetMin", settings.targetMin);
    lsSet("ink_punct", settings.punct);
    lsSet("ink_userAge", settings.userAge);
    lsSet("ink_sessionsPerDay", settings.sessionsPerDayTarget);
  }, [settings, mounted]);

  useEffect(() => {
    if (!mounted) return;
    lsSet("ink_history", history);
  }, [history, mounted]);

  const streak = useMemo(() => computeStreak(history), [history]);
  const weeklyFocus = useMemo(() => computeWeeklyFocus(history), [history]);
  const adaptiveSkill = weeklyFocus ? PASSAGE_SKILL_FOR_DIM[weeklyFocus.name] : null;
  const adaptiveTag = useMemo(() => passageSkillTag(currentPassage), [currentPassage]);

  const shufflePassage = useCallback(() => {
    const focus = computeWeeklyFocus(history);
    const skill = focus ? PASSAGE_SKILL_FOR_DIM[focus.name] : null;
    const { passage, deck: nextDeck } = pickPassage(deck, skill);
    setCurrentPassage(passage);
    setDeck(nextDeck);
    lsSet("ink_deck", nextDeck);
  }, [deck, history]);

  const deleteSession = useCallback((date: string, seq: number) => {
    setHistory((h) => h.filter((x) => !(x.date === date && x.seq === seq)));
  }, []);

  // Owned here, not by FinishView, specifically so the review survives the
  // user navigating away mid-review — this component never unmounts while
  // the app is open, unlike whichever screen happened to trigger the save.
  const triggerReview = useCallback(
    async (target: { date: string; seq: number }, photoFile: File, passageText: string) => {
      const mark = (patch: Partial<SessionRecord>) =>
        setHistory((h) => h.map((x) => (x.date === target.date && x.seq === target.seq ? { ...x, ...patch } : x)));

      mark({ reviewStatus: "pending", reviewError: undefined });
      try {
        const form = new FormData();
        form.append("photo", photoFile);
        form.append("passageText", passageText);
        if (settings.userAge) form.append("userAge", String(settings.userAge));
        const res = await fetch("/api/review", { method: "POST", body: form });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.message || `Review failed (${json?.code || res.status})`);
        mark({ legibility: json.legibility, accuracy: json.accuracy, reviewStatus: "done" });
      } catch (err) {
        mark({ reviewStatus: "failed", reviewError: err instanceof Error ? err.message : "Unknown error" });
      }
    },
    [settings.userAge]
  );

  // For retrying from anywhere other than the Finish screen (e.g. the Home
  // log), the original File object is long gone — only the saved photo's
  // data URL remains — so rebuild a File from it.
  const retryReviewFromRecord = useCallback(
    async (record: SessionRecord) => {
      if (!record.photo) return;
      const file = await dataUrlToFile(record.photo.src, "retry-photo.jpg");
      await triggerReview({ date: record.date, seq: record.seq }, file, record.passageText);
    },
    [triggerReview]
  );

  if (!mounted) return null;

  return (
    <div className="min-h-screen" style={{ background: "var(--paper)", color: "var(--ink)" }}>
      {view === "home" && (
        <HomeView
          settings={settings}
          setSettings={setSettings}
          history={history}
          onDeleteSession={deleteSession}
          onRetryReview={retryReviewFromRecord}
          streak={streak}
          weeklyFocus={weeklyFocus}
          currentPassage={currentPassage}
          adaptiveTag={adaptiveTag}
          adaptiveSkill={adaptiveSkill}
          onShuffle={shufflePassage}
          useCustom={useCustom}
          setUseCustom={setUseCustom}
          customText={customText}
          setCustomText={setCustomText}
          storageWarning={storageWarning}
          voice={voice}
          onStart={() => setView("practice")}
          onOpenDashboard={() => setView("dashboard")}
          onOpenProgress={() => setView("progress")}
        />
      )}
      {view === "practice" && (
        <PracticeView
          settings={settings}
          passage={currentPassage}
          useCustom={useCustom}
          customText={customText}
          voice={voice}
          onExit={() => setView("home")}
          onFinish={(draft) => {
            setFinishDraft(draft);
            setView("finish");
          }}
        />
      )}
      {view === "finish" && finishDraft && (
        <FinishView
          draft={finishDraft}
          history={history}
          todaySeqBase={history.filter((h) => h.date === finishDraft.date).length}
          onUpsert={(record) => {
            setHistory((h) => [...h.filter((x) => !(x.date === record.date && x.seq === record.seq)), record]);
          }}
          onTriggerReview={triggerReview}
          onBackToLog={() => {
            setFinishDraft(null);
            setView("home");
          }}
        />
      )}
      {view === "dashboard" && <DashboardView history={history} onClose={() => setView("home")} />}
      {view === "progress" && <ProgressView history={history} onClose={() => setView("home")} />}
    </div>
  );
}
