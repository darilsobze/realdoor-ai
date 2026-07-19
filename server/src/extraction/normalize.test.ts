import { describe, expect, it } from "vitest";
import { parseDate } from "./normalize.ts";

describe("parseDate", () => {
  it("normalizes a date split into multiple OCR tokens", () => {
    expect(parseDate("06 / 01 / 2026")).toBe("2026-06-01");
  });
});
