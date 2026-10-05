/**
 * Breaks a sentence into short, natural pause-points for phrase-by-phrase
 * dictation playback: comma/semicolon/colon/dash boundaries first, then
 * further splits any still-long fragment by word count (~7 words/chunk).
 * Fragments shorter than 3 words get merged into the previous chunk to
 * avoid awkward single-word pauses.
 */
export function splitIntoPhrases(sentence: string): string[] {
  const rough = sentence.split(/(?<=[,;:—])\s+/);
  const chunks: string[] = [];
  rough.forEach((frag) => {
    frag = frag.trim();
    if (!frag) return;
    const words = frag.split(/\s+/);
    if (words.length > 11) {
      let buf: string[] = [];
      words.forEach((w) => {
        buf.push(w);
        if (buf.length >= 7) {
          chunks.push(buf.join(" "));
          buf = [];
        }
      });
      if (buf.length) chunks.push(buf.join(" "));
    } else {
      chunks.push(frag);
    }
  });

  const merged: string[] = [];
  chunks.forEach((c) => {
    const wc = c.split(/\s+/).length;
    if (wc < 3 && merged.length) {
      merged[merged.length - 1] = merged[merged.length - 1] + " " + c;
    } else {
      merged.push(c);
    }
  });
  return merged.length ? merged : [sentence];
}

/** Trailing punctuation mark of a phrase, mapped to its on-screen cue label. */
const PUNCT_CUE: Record<string, string> = {
  ",": "Ends with a comma",
  ";": "Ends with a semicolon",
  ":": "Ends with a colon",
  "—": "Ends with a dash",
  ".": "Ends with a full stop",
  "?": "Ends with a question mark",
  "!": "Ends with an exclamation mark",
};

export function punctuationCue(phraseText: string): string | null {
  const last = phraseText.trim().slice(-1);
  return PUNCT_CUE[last] || null;
}

/** Expands punctuation into spoken words, classic dictée style, when enabled. */
export function speakableVersion(sentence: string, announcePunct: boolean): string {
  if (!announcePunct) return sentence;
  let s = sentence;
  s = s.replace(/,/g, " comma,");
  s = s.replace(/;/g, " semicolon;");
  s = s.replace(/:/g, " colon:");
  s = s.replace(/—/g, " dash");
  s = s.replace(/\?/g, " question mark.");
  s = s.replace(/!/g, " exclamation mark.");
  s = s.replace(/\.$/, " full stop.");
  return s;
}

/** Splits a pasted custom passage into sentences for phrase-pacing. */
export function splitCustom(text: string): string[] {
  const parts = text.replace(/\s+/g, " ").trim().split(/(?<=[.!?])\s+/);
  return parts.filter((p) => p.trim().length > 0);
}

export type Phrase = {
  text: string;
  sentenceIdx: number;
};

export function buildPhrases(sentences: string[]): Phrase[] {
  const phrases: Phrase[] = [];
  sentences.forEach((sentence, sentenceIdx) => {
    splitIntoPhrases(sentence).forEach((text) => {
      phrases.push({ text, sentenceIdx });
    });
  });
  return phrases;
}
