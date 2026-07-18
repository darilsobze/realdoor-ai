import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OcrPage, OcrWord } from "../ocr.ts";

const { extractFieldsMock, ocrPdfMock } = vi.hoisted(() => ({
  extractFieldsMock: vi.fn(),
  ocrPdfMock: vi.fn(),
}));

vi.mock("./extract.ts", () => ({ extractFields: extractFieldsMock }));
vi.mock("../ocr.ts", () => ({ ocrPdf: ocrPdfMock }));

import { extractDocument } from "./pipeline.ts";

function word(text: string, x: number): OcrWord {
  return {
    text,
    confidence: 95,
    bbox: { x, y: 10, width: 20, height: 10 },
    page: 1,
  };
}

function page(words: OcrWord[]): OcrPage {
  return {
    page: 1,
    widthPts: 612,
    heightPts: 792,
    png: Buffer.from("png"),
    words,
    text: words.map((item) => item.text).join(" "),
  };
}

describe("extractDocument", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps document_type proposed when classification heading evidence cannot be token-matched", async () => {
    ocrPdfMock.mockResolvedValue([page([word("Employer", 10)])]);
    extractFieldsMock.mockResolvedValue({
      document_type: "pay_stub",
      document_type_evidence: "Earnings Statement",
      fields: [],
    });

    const result = await extractDocument("doc-1", new Uint8Array());
    const documentType = result.fields.find((field) => field.field_name === "document_type");

    expect(documentType).toMatchObject({
      state: "proposed",
      model_proposed_value: "pay_stub",
      normalized_value: "pay_stub",
    });
  });
});
