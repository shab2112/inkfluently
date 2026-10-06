import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FinishView } from "./FinishView";
import type { FinishDraft } from "./PracticeView";
import type { Settings } from "./InkfluentlyApp";

// These three touch real browser-only CV libraries (CDN WASM loads, canvas,
// tesseract workers) that don't run in jsdom and are already covered by
// separate, dedicated testing (see docs/spec.md §6 work). Mocked here so this
// test isolates exactly what it's verifying: the Save/Retry button wiring.
vi.mock("@/lib/pageCrop", () => ({
  extractPageFromPhoto: vi.fn(async () => ({ status: "unavailable", reason: "mocked" })),
  prewarmPageCropLibs: vi.fn(),
  dataUrlToFile: vi.fn(async (dataUrl: string, filename: string) => new File([dataUrl], filename, { type: "image/jpeg" })),
}));
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
}));

const draft: FinishDraft = {
  date: "2026-10-06",
  elapsedSec: 120,
  wordCount: 40,
  topic: "Test topic",
  passageText: "This is the test passage text.",
};
const settings: Settings = {
  name: "",
  targetMin: 12,
  punct: false,
  userAge: 16,
  sessionsPerDayTarget: 1,
};

function selectFile(input: HTMLElement) {
  const file = new File(["fake-image-bytes"], "photo.jpg", { type: "image/jpeg" });
  return userEvent.upload(input, file);
}

describe("FinishView", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('"save anyway" on the OCR warning actually saves (regression test for the bug where it only dismissed the warning)', async () => {
    const onUpsert = vi.fn();
    const onBackToLog = vi.fn();
    global.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ legibility: null, accuracy: null }), { status: 200 })
    ) as unknown as typeof fetch;

    render(
      <FinishView draft={draft} settings={settings} todaySeqBase={0} onUpsert={onUpsert} onBackToLog={onBackToLog} />
    );

    const fileInput = document.querySelector('input[type="file"]') as HTMLElement;
    await selectFile(fileInput);

    const overrideLink = await screen.findByText("It is the right page — save anyway");
    await userEvent.click(overrideLink);

    await waitFor(() => expect(screen.getByText("Saved!")).toBeInTheDocument());
    expect(onUpsert).toHaveBeenCalled();
  });

  it('"Retry review" re-runs the review call and shows the result on success', async () => {
    const onUpsert = vi.fn();
    const onBackToLog = vi.fn();
    let callCount = 0;
    global.fetch = vi.fn(async () => {
      callCount++;
      if (callCount === 1) {
        return new Response(JSON.stringify({ code: "upstream_error", message: "simulated failure" }), { status: 502 });
      }
      return new Response(
        JSON.stringify({
          legibility: { score: 4, feedback: "Good", dimensions: [] },
          accuracy: { score: 4, errors: [], summary: "Good" },
        }),
        { status: 200 }
      );
    }) as unknown as typeof fetch;

    render(
      <FinishView draft={draft} settings={settings} todaySeqBase={0} onUpsert={onUpsert} onBackToLog={onBackToLog} />
    );

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
});
