"use client";

import { useEffect, useRef, useState } from "react";
import type { FinishDraft } from "@/components/PracticeView";
import { computeWpm } from "@/lib/history";
import type { SessionRecord } from "@/lib/types";
import { runOcrPhraseMatch, type OcrGateResult } from "@/lib/ocrGate";
import { runFaceCheck, prewarmFaceDetector, type FaceGateResult } from "@/lib/faceGate";
import { downscaleDataUrl, dataUrlToFile } from "@/lib/imageResize";
import { ReviewResults } from "@/components/ReviewResults";

function fmtClock(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s < 10 ? "0" : ""}${s}`;
}

export function FinishView({
  draft,
  history,
  todaySeqBase,
  onUpsert,
  onTriggerReview,
  onBackToLog,
}: {
  draft: FinishDraft;
  history: SessionRecord[];
  todaySeqBase: number;
  onUpsert: (record: SessionRecord) => void;
  onTriggerReview: (target: { date: string; seq: number }, photoFile: File, passageText: string) => Promise<void>;
  onBackToLog: () => void;
}) {
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [saved, setSaved] = useState(false);
  const [savedSeq, setSavedSeq] = useState<number | null>(null);
  const [reviewStartedAt, setReviewStartedAt] = useState<number | null>(null);
  const [reviewSeconds, setReviewSeconds] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // The review itself is owned by the always-mounted root component (see
  // InkfluentlyApp's triggerReview) specifically so it survives navigating
  // away from this screen — this just reads the live result back out of the
  // shared history as it updates, rather than tracking its own copy.
  const currentRecord = history.find((h) => h.date === draft.date && h.seq === savedSeq);

  useEffect(() => {
    if (currentRecord?.reviewStatus !== "pending" || reviewStartedAt == null) return;
    const tick = setInterval(() => setReviewSeconds(Math.round((Date.now() - reviewStartedAt) / 1000)), 1000);
    return () => clearInterval(tick);
  }, [currentRecord?.reviewStatus, reviewStartedAt]);

  // Two-layer safety gate from docs/spec.md §6, both best-effort, running
  // client-side on the full (uncropped) downscaled photo. Cropping to just
  // the page used to happen here too, client-side — it's now mandatory and
  // server-side instead (see src/lib/pageCropServer.ts and the /api/review
  // route), specifically so it can't be skipped by any client. A crop
  // failure now surfaces as a normal review failure (reviewStatus "failed",
  // via the existing ReviewResults retry UI) rather than a pre-save gate.
  const [gateStatus, setGateStatus] = useState<"idle" | "checking" | "done">("idle");
  const [ocrResult, setOcrResult] = useState<OcrGateResult | null>(null);
  const [faceResult, setFaceResult] = useState<FaceGateResult | null>(null);
  const [overrideOcrWarning, setOverrideOcrWarning] = useState(false);

  const wpm = computeWpm(draft.wordCount, draft.elapsedSec);

  // Kick off the heavy one-time library load (MediaPipe's WASM+model) the
  // moment this screen appears, not when the user hits Save — see
  // prewarmFaceDetector's doc comment for why this matters (a main-thread
  // block was reproduced and traced to this cold-load cost).
  useEffect(() => {
    prewarmFaceDetector();
  }, []);

  function retake() {
    setPhotoFile(null);
    setPhotoPreview(null);
    setGateStatus("idle");
    setOcrResult(null);
    setFaceResult(null);
    setOverrideOcrWarning(false);
  }

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setOverrideOcrWarning(false);
    setOcrResult(null);
    setFaceResult(null);
    setGateStatus("checking");

    const rawDataUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    });
    setPhotoPreview(rawDataUrl); // immediate feedback; replaced below once downscaled

    // Camera photos run several megapixels — running Tesseract/face detection
    // directly on that blocks the main thread long enough to freeze the tab
    // ("page isn't responding"). Downscale once, up front.
    const activeDataUrl = await downscaleDataUrl(rawDataUrl);
    const activeFile = await dataUrlToFile(activeDataUrl, "photo.jpg");
    setPhotoFile(activeFile);
    setPhotoPreview(activeDataUrl);

    const [ocr, face] = await Promise.all([
      runOcrPhraseMatch(activeFile, draft.passageText),
      runFaceCheck(activeDataUrl),
    ]);
    setOcrResult(ocr);
    setFaceResult(face);
    setGateStatus("done");
  }

  // Hard, non-overridable block — no "save anyway" path, unlike the OCR
  // content-match warning below. A photo whose "no face in frame" check
  // couldn't be confirmed to have actually run is a safety issue, not a
  // convenience one.
  const faceBlocked = faceResult?.status === "face_detected";
  const faceCheckFailed = faceResult?.status === "check_failed";
  const ocrWarning = gateStatus === "done" && ocrResult?.status === "no_match" && !overrideOcrWarning;
  const canSave = !!photoPreview && gateStatus === "done" && !faceBlocked && !faceCheckFailed && !ocrWarning;

  function startReview(target: { date: string; seq: number }) {
    if (!photoFile) return;
    setReviewStartedAt(Date.now());
    setReviewSeconds(0);
    onTriggerReview(target, photoFile, draft.passageText);
  }

  async function handleSave() {
    // Guard here too, not just via the main button's `disabled` — the OCR
    // "save anyway" override below calls handleSave() directly, bypassing
    // that button entirely. The face safety gate must never be skippable
    // through that path, only the OCR content-match warning is.
    if (faceBlocked || faceCheckFailed) return;
    const seq = todaySeqBase + 1;
    const baseRecord: SessionRecord = {
      date: draft.date,
      seq,
      topic: draft.topic,
      passageText: draft.passageText,
      durationSec: draft.elapsedSec,
      wordCount: draft.wordCount,
      wpm,
      photo: photoPreview ? { kind: "local", src: photoPreview } : null,
      note: note.trim().slice(0, 200),
      legibility: null,
      accuracy: null,
      synced: false,
      reviewStatus: "pending",
    };
    onUpsert(baseRecord);
    setSavedSeq(seq);
    setSaved(true);
    startReview({ date: draft.date, seq });
  }

  return (
    <div className="fixed inset-0 flex flex-col px-5 pt-5 pb-5 overflow-y-auto" style={{ background: "var(--paper)" }}>
      <div className="max-w-[480px] mx-auto w-full flex flex-col gap-4.5">
        {!saved ? (
          <>
            <div>
              <h2 className="text-[22px] font-bold mb-1.5">Nice work! 🎉</h2>
              <p className="text-sm" style={{ color: "var(--ink-soft)" }}>
                You practiced for <span className="font-mono-ink">{fmtClock(draft.elapsedSec)}</span>. Snap a photo
                of the page you wrote.
              </p>
            </div>

            {!photoPreview ? (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="rounded-2xl border-2 border-dashed px-4 py-6 text-center"
                style={{ borderColor: "var(--rule)", background: "var(--paper-2)" }}
              >
                <div className="font-semibold text-sm">Take or upload a photo</div>
                <div className="text-xs mt-1" style={{ color: "var(--ink-soft)" }}>
                  Tap to open your camera or photo library
                </div>
              </button>
            ) : (
              <div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photoPreview} alt="" className="w-full rounded-2xl border" style={{ borderColor: "var(--rule)" }} />
                <div className="flex items-center justify-between gap-2.5 mt-2 text-xs">
                  <span
                    style={{ color: gateStatus === "done" ? "var(--good)" : "var(--ink-soft)" }}
                    className="font-bold"
                  >
                    {gateStatus === "checking" ? "Checking photo…" : "✓ Photo ready"}
                  </span>
                  <button type="button" onClick={retake} style={{ color: "var(--ink-soft)" }} className="underline">
                    Choose a different photo
                  </button>
                </div>

                {faceBlocked && (
                  <div
                    className="rounded-lg border px-3 py-2.5 mt-2 text-xs"
                    style={{ background: "var(--accent-soft)", borderColor: "var(--danger)", color: "var(--danger)" }}
                  >
                    <div className="font-bold">A person appears to be in this photo</div>
                    <div className="mt-1">
                      Only the written page should be in frame — please retake it without anyone (or any reflection)
                      visible.
                    </div>
                  </div>
                )}

                {faceCheckFailed && (
                  <div
                    className="rounded-lg border px-3 py-2.5 mt-2 text-xs"
                    style={{ background: "var(--accent-soft)", borderColor: "var(--danger)", color: "var(--danger)" }}
                  >
                    <div className="font-bold">Couldn&apos;t verify no one is in this photo</div>
                    <div className="mt-1">
                      For safety, we don&apos;t send a photo for review unless this check can actually confirm no
                      one&apos;s face is in frame — it didn&apos;t finish this time, so please try again.
                      {faceResult?.reason ? ` (${faceResult.reason})` : ""}
                    </div>
                  </div>
                )}

                {ocrWarning && (
                  <div
                    className="rounded-lg border px-3 py-2.5 mt-2 text-xs"
                    style={{ background: "var(--gold-soft)", borderColor: "var(--gold)", color: "var(--gold)" }}
                  >
                    <div className="font-bold">We couldn&apos;t confirm this matches today&apos;s passage</div>
                    <div className="mt-1">
                      Handwriting is genuinely hard for this automatic check to read too, so this isn&apos;t
                      definitive — but double check it&apos;s a photo of the right page.
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setOverrideOcrWarning(true);
                        handleSave();
                      }}
                      className="underline font-semibold mt-1.5"
                    >
                      It is the right page — save anyway
                    </button>
                  </div>
                )}

                {gateStatus === "done" && ocrResult?.status === "check_failed" && (
                  <div className="text-[11px] mt-1.5" style={{ color: "var(--ink-faint)" }}>
                    (The passage-match text check didn&apos;t run this time — unlike the face check, this one&apos;s
                    just a content sanity-check, not a safety gate, so saving still works normally.
                    {ocrResult.reason ? ` ${ocrResult.reason}.` : ""})
                  </div>
                )}
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              hidden
              onChange={onFileChange}
            />

            <div
              className="text-[11.5px] rounded-lg border border-dashed px-3 py-2"
              style={{ color: "var(--ink-faint)", borderColor: "var(--rule)" }}
            >
              🔒 Only photograph the page you wrote — never people or personal documents. Before analysis, the
              photo is automatically cropped down to just the written page — if that can&apos;t be confirmed, it
              won&apos;t be sent at all (you&apos;ll see a retry option instead). This photo is analyzed by a
              third-party AI service, which may use it to help improve their models.
            </div>

            <div>
              <label className="text-sm font-semibold block mb-1.5">Note (optional)</label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. Missed one comma, fixed it myself"
                className="w-full rounded-lg border px-3 py-2.5 text-sm"
                style={{ background: "var(--paper)", borderColor: "var(--rule)" }}
              />
            </div>

            <button
              type="button"
              disabled={!canSave}
              onClick={handleSave}
              className="rounded-xl py-3.5 text-[15px] font-bold w-full disabled:opacity-45"
              style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
            >
              {gateStatus === "checking"
                ? "Checking photo…"
                : faceBlocked
                ? "Retake photo to save"
                : faceCheckFailed
                ? "Retry photo to save"
                : ocrWarning
                ? "Confirm the passage match above to save"
                : "Save today's practice"}
            </button>
          </>
        ) : (
          <div
            className="flex flex-col items-center text-center gap-1.5 rounded-2xl border px-4.5 py-6"
            style={{ background: "var(--good-soft)", borderColor: "var(--good)" }}
          >
            <div
              className="w-11 h-11 rounded-full flex items-center justify-center text-xl font-bold mb-1"
              style={{ background: "var(--good)", color: "var(--paper)" }}
            >
              ✓
            </div>
            <div className="font-serif-brand text-xl font-bold" style={{ color: "var(--good)" }}>
              Saved!
            </div>
            <div className="text-sm mb-2.5" style={{ color: "var(--ink-soft)" }}>
              Your practice is in the log.
            </div>

            {wpm != null && (
              <div className="w-full rounded-xl p-3.5 mb-3" style={{ background: "var(--paper)" }}>
                <div className="font-serif-brand text-2xl font-bold">{wpm}</div>
                <div className="text-xs" style={{ color: "var(--ink-soft)" }}>
                  Words per minute
                </div>
                <div className="text-[11px] mt-1 leading-snug" style={{ color: "var(--ink-faint)" }}>
                  Counts the whole session — listening, replays, and writing together. Needing fewer replays over
                  time shows up here too.
                </div>
              </div>
            )}

            {currentRecord && (
              <ReviewResults
                record={currentRecord}
                reviewSeconds={reviewSeconds}
                onRetry={() => startReview({ date: currentRecord.date, seq: currentRecord.seq })}
              />
            )}

            <button
              type="button"
              onClick={onBackToLog}
              className="rounded-xl border py-3 text-sm font-bold w-full mt-3.5"
              style={{ borderColor: "var(--rule)" }}
            >
              Back to today&apos;s log →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
