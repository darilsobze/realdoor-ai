// Map an extracted raw_text back onto the OCR word tokens for exact bounding
// boxes, and derive the confidence tier from the match quality:
//   exact token(-sequence) match  -> "high"
//   fuzzy (normalized) match      -> "medium"
//   no match                      -> "none" (abstain: no bbox, no value reuse)
import type { BBox, ConfidenceTier } from "../../../web/src/contracts/index.ts";
import type { OcrWord } from "../ocr.ts";

export interface TokenMatch {
  tier: ConfidenceTier;
  /** Merged box over the matched tokens; null when tier is "none". */
  bbox: BBox | null;
  /** Mean tesseract word confidence of the matched tokens, 0–1; null when "none". */
  confidence: number | null;
  /** The matched OCR tokens joined by single spaces (evidence text). */
  matchedText: string | null;
}

const NO_MATCH: TokenMatch = { tier: "none", bbox: null, confidence: null, matchedText: null };

function fuzzyKey(s: string): string {
  // Case, punctuation and separator differences collapse; digits and letters must agree.
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function mergeBoxes(words: OcrWord[]): BBox {
  const x0 = Math.min(...words.map((w) => w.bbox.x));
  const y0 = Math.min(...words.map((w) => w.bbox.y));
  const x1 = Math.max(...words.map((w) => w.bbox.x + w.bbox.width));
  const y1 = Math.max(...words.map((w) => w.bbox.y + w.bbox.height));
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

function toMatch(words: OcrWord[], tier: ConfidenceTier): TokenMatch {
  const meanConf = words.reduce((a, w) => a + w.confidence, 0) / words.length / 100;
  return {
    tier,
    bbox: mergeBoxes(words),
    confidence: Math.max(0, Math.min(1, meanConf)),
    matchedText: words.map((w) => w.text).join(" "),
  };
}

function findSequence(
  needle: string[],
  words: OcrWord[],
  key: (s: string) => string,
): OcrWord[] | null {
  if (needle.length === 0) return null;
  const target = needle.map(key).filter((t) => t.length > 0);
  if (target.length === 0) return null;
  const keys = words.map((w) => key(w.text));
  outer: for (let i = 0; i <= keys.length - target.length; i++) {
    for (let j = 0; j < target.length; j++) {
      if (keys[i + j] !== target[j]) continue outer;
    }
    return words.slice(i, i + target.length);
  }
  return null;
}

/**
 * Locate raw_text among the page's OCR words.
 * Multi-word values must appear as a consecutive token run.
 */
export function matchValueToTokens(rawText: string, pageWords: OcrWord[]): TokenMatch {
  const tokens = rawText.trim().split(/\s+/);
  if (tokens.length === 0 || pageWords.length === 0) return NO_MATCH;

  const exact = findSequence(tokens, pageWords, (s) => s);
  if (exact) return toMatch(exact, "high");

  const fuzzy = findSequence(tokens, pageWords, fuzzyKey);
  if (fuzzy) return toMatch(fuzzy, "medium");

  // Last resort for values OCR may have merged/split: substring of the joined
  // fuzzy page text. Still "medium" (we can locate a covering token span).
  const joinedNeedle = fuzzyKey(rawText);
  if (joinedNeedle.length >= 3) {
    const pageKeys = pageWords.map((w) => fuzzyKey(w.text));
    for (let i = 0; i < pageKeys.length; i++) {
      let acc = "";
      for (let j = i; j < pageKeys.length && acc.length < joinedNeedle.length; j++) {
        acc += pageKeys[j];
        if (acc === joinedNeedle) return toMatch(pageWords.slice(i, j + 1), "medium");
      }
    }
  }

  return NO_MATCH;
}
