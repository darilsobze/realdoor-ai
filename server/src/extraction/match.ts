// Map an extracted raw_text back onto the OCR word tokens for exact bounding
// boxes, and derive the confidence tier from the match quality:
//   exact token(-sequence) match  -> "high"
//   fuzzy (normalized) match      -> "medium"
//   no match                      -> "none" (abstain: no bbox, no value reuse)
import type { BBox, ConfidenceTier } from "../../../web/src/contracts/index.ts";
import type { OcrWord } from "../ocr.ts";
import { parseDate } from "./normalize.ts";

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

/** An "exact" text match over tokens the OCR itself barely trusts is not
 *  high-confidence evidence — degraded scans can garble INTO the right shape
 *  as easily as out of it. Below this mean word confidence, demote to medium
 *  so the renter is asked to double-check. */
const LOW_OCR_CONFIDENCE = 0.6;

function toMatch(words: OcrWord[], tier: ConfidenceTier): TokenMatch {
  const meanConf = words.reduce((a, w) => a + w.confidence, 0) / words.length / 100;
  const confidence = Math.max(0, Math.min(1, meanConf));
  return {
    tier: tier === "high" && confidence < LOW_OCR_CONFIDENCE ? "medium" : tier,
    bbox: mergeBoxes(words),
    confidence,
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

// OCR letter shapes that stand in for digits (0/O, 1/l/I, 5/S, 8/B).
const CONFUSABLE_TO_DIGIT: Record<string, string> = {
  o: "0",
  l: "1",
  i: "1",
  s: "5",
  b: "8",
};

/** Lowercase, map confusable letters to digits, drop everything non-digit. */
function digitKey(s: string): string {
  return s
    .toLowerCase()
    .replace(/[olisb]/g, (c) => CONFUSABLE_TO_DIGIT[c])
    .replace(/[^0-9]/g, "");
}

function hamming(a: string, b: string): number {
  let d = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) d++;
  return d;
}

/**
 * Tolerant matching for DATE values only: OCR often garbles one glyph in a
 * date ("06/14/2026" read as "0644/2026"). Find the needle's digit sequence
 * in the page's digit stream allowing Hamming distance ≤ 1 — but only when
 * the match is UNIQUE on the page. Two candidate windows = genuinely
 * ambiguous = no match (we fix matching, we never loosen abstention).
 */
function matchDateDigits(rawText: string, pageWords: OcrWord[]): TokenMatch | null {
  const needle = digitKey(rawText);
  if (needle.length < 6) return null;

  // Page digit stream, each digit remembering its source word.
  const stream: { d: string; word: number }[] = [];
  pageWords.forEach((w, wi) => {
    for (const d of digitKey(w.text)) stream.push({ d, word: wi });
  });
  if (stream.length < needle.length) return null;

  const hits: { start: number; dist: number }[] = [];
  for (let i = 0; i + needle.length <= stream.length; i++) {
    const window = stream
      .slice(i, i + needle.length)
      .map((c) => c.d)
      .join("");
    const dist = hamming(needle, window);
    if (dist <= 1) hits.push({ start: i, dist });
  }
  if (hits.length === 0) return null;

  const best = Math.min(...hits.map((h) => h.dist));
  const winners = hits.filter((h) => h.dist === best);
  if (winners.length > 1) return null; // ambiguous → abstain

  const span = stream.slice(winners[0].start, winners[0].start + needle.length);
  const words = pageWords.slice(span[0].word, span[span.length - 1].word + 1);
  return toMatch(words, "medium");
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

  // Dates only: tolerate a single OCR-garbled glyph when the digit-sequence
  // match is unique on the page.
  if (parseDate(rawText) !== null) {
    const dateMatch = matchDateDigits(rawText, pageWords);
    if (dateMatch) return dateMatch;
  }

  return NO_MATCH;
}
