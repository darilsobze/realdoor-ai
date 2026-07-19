import { describe, expect, it } from "vitest";
import type { OcrWord } from "../ocr.ts";
import { matchValueToTokens } from "./match.ts";

function word(text: string, x = 0): OcrWord {
  return { text, confidence: 80, bbox: { x, y: 10, width: 20, height: 10 }, page: 1 };
}

describe("matchValueToTokens — low-quality OCR demotion", () => {
  it("demotes an exact text match to medium when OCR distrusts the token", () => {
    const w: OcrWord = {
      text: "$1,850.00",
      confidence: 21,
      bbox: { x: 0, y: 10, width: 20, height: 10 },
      page: 1,
    };
    const m = matchValueToTokens("$1,850.00", [w]);
    expect(m.tier).toBe("medium");
    expect(m.confidence).toBeCloseTo(0.21);
  });

  it("keeps high tier for exact matches on trusted tokens", () => {
    const m = matchValueToTokens("$1,580.00", [
      { text: "$1,580.00", confidence: 86, bbox: { x: 0, y: 10, width: 20, height: 10 }, page: 1 },
    ]);
    expect(m.tier).toBe("high");
  });
});

describe("matchValueToTokens — date digit tolerance", () => {
  it("matches a date whose slash+digit was garbled into another digit (06/14 → 0644)", () => {
    const m = matchValueToTokens("06/14/2026", [word("Pay"), word("0644/2026", 50)]);
    expect(m.tier).toBe("medium");
    expect(m.matchedText).toBe("0644/2026");
  });

  it("matches a date with a confusable letter (O6/I4/2026)", () => {
    const m = matchValueToTokens("06/14/2026", [word("O6/I4/2026")]);
    expect(m.tier).toBe("medium");
  });

  it("matches a date split across tokens with one garbled glyph", () => {
    const m = matchValueToTokens("06/16/2026", [word("06/46"), word("/2026", 30)]);
    expect(m.tier).toBe("medium");
    expect(m.matchedText).toBe("06/46 /2026");
  });

  it("abstains when two candidate windows are equally close (ambiguous)", () => {
    // Needle 06/14/2026: both 06442026 and 06142026-with-noise... use two
    // distinct dist-1 windows: "0644/2026" and "0654/2026".
    const m = matchValueToTokens("06/14/2026", [word("0644/2026"), word("0654/2026", 90)]);
    expect(m.tier).toBe("none");
    expect(m.bbox).toBeNull();
  });

  it("prefers the unique exact digit window over a garbled one", () => {
    const m = matchValueToTokens("06/14/2026", [word("06/44/2026"), word("06/14/2026", 90)]);
    // exact token match wins outright at high tier
    expect(m.tier).toBe("high");
  });

  it("does not apply digit tolerance to non-date values", () => {
    // "$1,580.00" garbled to "$1,586.00" must NOT fuzzy-match via digits.
    const m = matchValueToTokens("$1,580.00", [word("$1,586.00")]);
    expect(m.tier).toBe("none");
  });

  it("still abstains when the date is nowhere on the page", () => {
    const m = matchValueToTokens("06/14/2026", [word("hello"), word("world", 30)]);
    expect(m.tier).toBe("none");
  });
});
