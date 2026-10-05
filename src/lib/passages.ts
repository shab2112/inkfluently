import raw from "./passages.json";
import type { Passage, PassageSkill } from "./types";

export const PASSAGES: Passage[] = raw as Passage[];

export function passageSkillTag(p: Passage): PassageSkill {
  const text = p.sentences.join(" ");
  const words = text
    .replace(/[^a-zA-Z' -]/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const totalChars = words.reduce((s, w) => s + w.length, 0);
  const avgLen = words.length ? totalChars / words.length : 0;
  const punctCount = (text.match(/[,;:—]/g) || []).length;
  const punctDensity = p.sentences.length ? punctCount / p.sentences.length : 0;
  if (avgLen >= 5.3) return "longWords";
  if (punctDensity >= 1.3) return "punctuation";
  return "varied";
}

export const PASSAGE_SKILL_FOR_DIM: Record<string, PassageSkill> = {
  letter_formation: "varied",
  size_consistency: "longWords",
  spacing: "punctuation",
  baseline: "punctuation",
  slant: "varied",
};

export const SKILL_NAMES: Record<PassageSkill, string> = {
  longWords: "longer words",
  punctuation: "extra punctuation practice",
  varied: "varied letter shapes",
};

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Picks the next passage from a shuffled "deck" of passage ids (no repeats
 * until the deck is exhausted), optionally pulling a passage matching
 * `preferredSkill` forward out of turn. Returns the chosen passage and the
 * updated deck — caller is responsible for persisting the deck.
 */
export function pickPassage(
  deck: string[],
  preferredSkill?: PassageSkill | null
): { passage: Passage; deck: string[] } {
  let nextDeckArr = deck;
  if (!nextDeckArr || !nextDeckArr.length) {
    nextDeckArr = shuffle(PASSAGES.map((p) => p.id));
  } else {
    nextDeckArr = nextDeckArr.slice();
  }

  let id: string | undefined;
  if (preferredSkill) {
    for (let di = 0; di < nextDeckArr.length; di++) {
      const cand = PASSAGES.find((p) => p.id === nextDeckArr[di]);
      if (cand && passageSkillTag(cand) === preferredSkill) {
        id = nextDeckArr.splice(di, 1)[0];
        break;
      }
    }
  }
  if (!id) id = nextDeckArr.shift();

  const passage = PASSAGES.find((p) => p.id === id) || PASSAGES[0];
  return { passage, deck: nextDeckArr };
}
