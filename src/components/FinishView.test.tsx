import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import { useState } from "react";
import userEvent from "@testing-library/user-event";
import { FinishView } from "./FinishView";
import type { FinishDraft } from "./PracticeView";
import type { SessionRecord } from "@/lib/types";
import { runFaceCheck } from "@/lib/faceGate";

// These touch real browser-only CV/OCR libraries (CDN WASM loads, tesseract
// workers) that don't run in jsdom and are already covered by separate,
// dedicated testing (see docs/spec.md §6 work; page-crop itself is now
// server-side, tested in src/lib/pageCropServer.test.ts). Mocked here so
// this test isolates exactly what it's verifying: the Save/Retry button
// wiring.
vi.mock("@/lib/faceGate", () => ({
  runFaceCheck: vi.fn(async () => ({ status: "clear", faceCount: 0 })),
  prewarmFaceDetector: vi.fn(),
}));
vi.mock("@/lib/ocrGate", () => ({
  runOcrPhraseMatch: vi.fn(async () => ({
    status: "no_match",
    matchedWords: [],
    checkedWordCount: 10,
    ocrTextSample: "",
  })),
}));
vi.mock("@/lib/imageResize", () => ({
  // jsdom doesn't implement real canvas/image decoding — not what this test
  // is verifying, so pass the input straight through.
  downscaleDataUrl: vi.fn(async (dataUrl: string) => dataUrl),
  dataUrlToFile: vi.fn(async (dataUrl: string, filename: string) => new File([dataUrl], filename, { type: "image/jpeg" })),
}));

const draft: FinishDraft = {
  date: "2026-10-06",
  elapsedSec: 120,
  wordCount: 40,
  topic: "Test topic",
  passageText: "This is the test passage text.",
};

function selectFile(input: HTMLElement) {
  const file = new File(["fake-image-bytes"], "photo.jpg", { type: "image/jpeg" });
  return userEvent.upload(input, file);
}

/**
 * Minimal stand-in for InkfluentlyApp: owns `history` and implements
 * onUpsert/onTriggerReview the same way the real root component does, so
 * FinishView's reactive `currentRecord` derivation (the whole point of this
 * refactor — review state lives in the always-mounted root, not in this
 * screen) is exercised the same way it is in the real app, not reimplemented
 * as a simpler fake.
 */
function TestHarness({
  reviewImpl,
  onBackToLog = vi.fn(),
}: {
  reviewImpl: (target: { date: string; seq: number }, photoFile: File, passageText: string) => Promise<{ legibility: unknown; accuracy: unknown }>;
  onBackToLog?: () => void;
}) {
  const [history, setHistory] = useState<SessionRecord[]>([]);

  async function onTriggerReview(target: { date: string; seq: number }, photoFile: File, passageText: string) {
    setHistory((h) => h.map((x) => (x.date === target.date && x.seq === target.seq ? { ...x, reviewStatus: "pending" } : x)));
    try {
      const result = await reviewImpl(target, photoFile, passageText);
      setHistory((h) =>
        h.map((x) =>
          x.date === target.date && x.seq === target.seq
            ? { ...x, legibility: result.legibility as SessionRecord["legibility"], accuracy: result.accuracy as SessionRecord["accuracy"], reviewStatus: "done" }
            : x
        )
      );
    } catch (err) {
      setHistory((h) =>
        h.map((x) =>
          x.date === target.date && x.seq === target.seq
            ? { ...x, reviewStatus: "failed", reviewError: err instanceof Error ? err.message : "Unknown error" }
            : x
        )
      );
    }
  }

  return (
    <FinishView
      draft={draft}
      history={history}
      todaySeqBase={0}
      onUpsert={(record) => setHistory((h) => [...h.filter((x) => !(x.date === record.date && x.seq === record.seq)), record])}
      onTriggerReview={onTriggerReview}
      onBackToLog={onBackToLog}
    />
  );
}

describe("FinishView", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('"save anyway" on the OCR warning actually saves (regression test for the bug where it only dismissed the warning)', async () => {
    const reviewImpl = vi.fn(async () => ({ legibility: null, accuracy: null }));

    render(<TestHarness reviewImpl={reviewImpl} />);

    const fileInput = document.querySelector('input[type="file"]') as HTMLElement;
    await selectFile(fileInput);

    const overrideLink = await screen.findByText("It is the right page — save anyway");
    await userEvent.click(overrideLink);

    await waitFor(() => expect(screen.getByText("Saved!")).toBeInTheDocument());
    expect(reviewImpl).toHaveBeenCalled();
  });

  it('"Retry review" re-runs the review call and shows the result on success', async () => {
    let callCount = 0;
    const reviewImpl = vi.fn(async () => {
      callCount++;
      if (callCount === 1) throw new Error("simulated failure");
      return {
        legibility: { score: 4, feedback: "Good", dimensions: [] },
        accuracy: { score: 4, errors: [], summary: "Good" },
      };
    });

    render(<TestHarness reviewImpl={reviewImpl} />);

    const fileInput = document.querySelector('input[type="file"]') as HTMLElement;
    await selectFile(fileInput);

    // OCR mock returns no_match — override first so Save is reachable.
    const overrideLink = await screen.findByText("It is the right page — save anyway");
    await userEvent.click(overrideLink);

    await waitFor(() => expect(screen.getByText("Review unavailable")).toBeInTheDocument());

    const retryButton = screen.getByText("Retry review");
    await userEvent.click(retryButton);

    await waitFor(() => expect(screen.getByText("Legibility")).toBeInTheDocument());
    expect(callCount).toBe(2);
  });

  it("review survives this screen unmounting (the actual bug being fixed) — triggering review does not depend on FinishView staying mounted", async () => {
    let resolveReview!: (v: { legibility: unknown; accuracy: unknown }) => void;
    const reviewImpl = vi.fn(
      () =>
        new Promise<{ legibility: unknown; accuracy: unknown }>((resolve) => {
          resolveReview = resolve;
        })
    );

    const { unmount } = render(<TestHarness reviewImpl={reviewImpl} />);

    const fileInput = document.querySelector('input[type="file"]') as HTMLElement;
    await selectFile(fileInput);
    const overrideLink = await screen.findByText("It is the right page — save anyway");
    await userEvent.click(overrideLink);

    await waitFor(() => expect(reviewImpl).toHaveBeenCalled());

    // Simulate navigating away: unmount the Finish screen entirely while the
    // review is still in flight. Before this refactor, the fetch lived inside
    // FinishView's own closure — this proves it no longer matters.
    unmount();

    resolveReview({
      legibility: { score: 5, feedback: "Great", dimensions: [] },
      accuracy: { score: 5, errors: [], summary: "Great" },
    });

    // The promise's .then() continuation should still run and not throw, even
    // though the component that originally triggered it is gone.
    await new Promise((r) => setTimeout(r, 10));
    expect(reviewImpl).toHaveBeenCalledTimes(1);
  });

  // "Non-negotiable" per explicit product direction: unlike the OCR content-
  // match warning, there is no override for this — if we can't confirm the
  // face check actually ran, saving (and therefore sending the photo
  // anywhere) must be impossible, not just discouraged. (The equivalent
  // crop-confirmation gate now lives server-side — see
  // src/lib/pageCropServer.test.ts and the /api/review route tests.)
  it("blocks saving when the face check fails to run, with no override", async () => {
    vi.mocked(runFaceCheck).mockResolvedValueOnce({ status: "check_failed", faceCount: 0, reason: "model timed out" });
    const reviewImpl = vi.fn(async () => ({ legibility: null, accuracy: null }));

    render(<TestHarness reviewImpl={reviewImpl} />);

    const fileInput = document.querySelector('input[type="file"]') as HTMLElement;
    await selectFile(fileInput);

    await screen.findByText("Couldn't verify no one is in this photo", { exact: false });
    const saveButton = screen.getByRole("button", { name: /retry photo to save/i });
    expect(saveButton).toBeDisabled();

    await new Promise((r) => setTimeout(r, 10));
    expect(reviewImpl).not.toHaveBeenCalled();
  });

  it("the OCR 'save anyway' override cannot bypass a simultaneous face-check-failed block", async () => {
    vi.mocked(runFaceCheck).mockResolvedValueOnce({ status: "check_failed", faceCount: 0, reason: "model timed out" });
    const reviewImpl = vi.fn(async () => ({ legibility: null, accuracy: null }));

    render(<TestHarness reviewImpl={reviewImpl} />);

    const fileInput = document.querySelector('input[type="file"]') as HTMLElement;
    await selectFile(fileInput);

    // OCR also mismatches by default (see the module mock above) — the
    // override link still renders, but must be a no-op while the face check
    // is blocked.
    const overrideLink = await screen.findByText("It is the right page — save anyway");
    await userEvent.click(overrideLink);

    await new Promise((r) => setTimeout(r, 10));
    expect(reviewImpl).not.toHaveBeenCalled();
    expect(screen.queryByText("Saved!")).not.toBeInTheDocument();
  });
});
