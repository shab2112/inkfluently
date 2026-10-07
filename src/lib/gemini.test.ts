import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { reviewHandwritingPhoto } from "./gemini";

function mockGeminiResponse(payload: Record<string, unknown>) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      candidates: [{ content: { parts: [{ text: JSON.stringify(payload) }] } }],
    }),
  } as Response;
}

// The prompt tells the model to reconcile legibility/accuracy itself (see
// buildReviewPrompt), but that's been observed to fail in real runs ~1 in 3
// times (letter_formation marked "good" while a confusable-letter spelling
// error is listed right next to it) — these tests verify the deterministic
// code-level cross-check that catches it regardless of model compliance.
describe("reviewHandwritingPhoto reconciliation", () => {
  const originalFetch = global.fetch;
  const originalKey = process.env.GEMINI_API_KEY;

  beforeEach(() => {
    process.env.GEMINI_API_KEY = "test-key";
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.GEMINI_API_KEY = originalKey;
  });

  it("escalates letter_formation to needs_work when a confusable-letter spelling error contradicts a 'good' flag", async () => {
    const payload = {
      legibility: {
        score: 4,
        feedback: "Nice work",
        dimensions: [
          { name: "letter_formation", label: "Letter formation", flag: "good" },
          { name: "size_consistency", label: "Size consistency", flag: "good" },
          { name: "spacing", label: "Spacing", flag: "good" },
          { name: "baseline", label: "Baseline", flag: "good" },
          { name: "slant", label: "Slant", flag: "good" },
        ],
      },
      accuracy: {
        score: 3,
        errors: [{ type: "spelling", expected: "far", found: "for" }],
        summary: "Watch spelling",
      },
    };
    global.fetch = vi.fn().mockResolvedValue(mockGeminiResponse(payload));

    const result = await reviewHandwritingPhoto("base64data", "image/jpeg", "a passage with the word far", null);

    const lf = result.legibility?.dimensions.find((d) => d.name === "letter_formation");
    expect(lf?.flag).toBe("needs_work");
    expect(lf?.tag).toBe("a-o");
    expect(lf?.exampleWord).toBe("far");
  });

  it("leaves letter_formation 'good' alone when accuracy errors aren't a known confusable swap", async () => {
    const payload = {
      legibility: {
        score: 5,
        feedback: "Great",
        dimensions: [{ name: "letter_formation", label: "Letter formation", flag: "good" }],
      },
      accuracy: {
        score: 4,
        errors: [{ type: "missing", expected: "the", found: "" }],
        summary: "Missing a word",
      },
    };
    global.fetch = vi.fn().mockResolvedValue(mockGeminiResponse(payload));

    const result = await reviewHandwritingPhoto("base64data", "image/jpeg", "passage", null);

    const lf = result.legibility?.dimensions.find((d) => d.name === "letter_formation");
    expect(lf?.flag).toBe("good");
  });

  it("does not override a dimension already marked needs_work", async () => {
    const payload = {
      legibility: {
        score: 3,
        feedback: "Keep practicing",
        dimensions: [
          {
            name: "letter_formation",
            label: "Letter formation",
            flag: "needs_work",
            note: "existing note",
            tag: "b-d-reversal",
            example_word: "dog",
          },
        ],
      },
      accuracy: {
        score: 3,
        errors: [{ type: "spelling", expected: "ran", found: "run" }],
        summary: "x",
      },
    };
    global.fetch = vi.fn().mockResolvedValue(mockGeminiResponse(payload));

    const result = await reviewHandwritingPhoto("base64data", "image/jpeg", "passage", null);

    const lf = result.legibility?.dimensions.find((d) => d.name === "letter_formation");
    expect(lf?.tag).toBe("b-d-reversal");
    expect(lf?.exampleWord).toBe("dog");
  });
});
