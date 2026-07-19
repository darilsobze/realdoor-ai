import { describe, expect, it } from "vitest";
import { adaptExtraction } from "./adapters";
import type { ExtractionResultDto } from "./schemas";

const extraction: ExtractionResultDto = {
  document_id: "doc-1",
  extraction_version: "extract-v3",
  fields: [
    {
      id: "field-gross",
      document_id: "doc-1",
      field_name: "gross_pay",
      raw_text: "$1,580.00",
      model_proposed_value: "$1,580.00",
      normalized_value: 1580,
      unit: "USD",
      page: 1,
      bbox: { x: 42, y: 210, width: 120, height: 18 },
      confidence: 0.96,
      confidence_tier: "high",
      state: "proposed",
      abstention_reason: null,
      extraction_version: "extract-v3",
    },
    {
      id: "field-frequency",
      document_id: "doc-1",
      field_name: "pay_frequency",
      raw_text: null,
      model_proposed_value: null,
      normalized_value: null,
      unit: null,
      page: null,
      bbox: null,
      confidence: null,
      confidence_tier: "none",
      state: "unresolved",
      abstention_reason: "This value could not be read.",
      extraction_version: "extract-v3",
    },
    {
      id: "field-type",
      document_id: "doc-1",
      field_name: "document_type",
      raw_text: "Employee Pay Statement",
      model_proposed_value: "pay_stub",
      normalized_value: "pay_stub",
      unit: null,
      page: 1,
      bbox: { x: 20, y: 20, width: 240, height: 25 },
      confidence: 0.9,
      confidence_tier: "high",
      state: "proposed",
      abstention_reason: null,
      extraction_version: "extract-v3",
    },
  ],
};

describe("extraction adapter", () => {
  it("preserves canonical values, confidence, and PDF evidence", () => {
    const document = adaptExtraction("session-1", "pay-stub.pdf", extraction);

    expect(document).toMatchObject({
      id: "doc-1",
      kind: "paystub",
      displayName: "pay-stub.pdf",
      synthetic: false,
      backendSessionId: "session-1",
    });
    expect(document.pageImages).toEqual(["/api/session/session-1/documents/doc-1/page/1"]);
    expect(document.proposedFields[0]).toMatchObject({
      name: "gross_pay",
      proposedValue: 1580,
      rawText: "$1,580.00",
      modelProposedValue: "$1,580.00",
      confidence: 0.96,
      confidenceTier: "high",
      state: "proposed",
      source: {
        page: 0,
        space: "pdf_points",
        bbox: { x: 42, y: 210, w: 120, h: 18 },
      },
    });
  });

  it("keeps abstentions explicit instead of inventing values", () => {
    const document = adaptExtraction("session-1", "pay-stub.pdf", extraction);
    expect(document.proposedFields[1]).toMatchObject({
      name: "pay_frequency",
      proposedValue: null,
      confidence: null,
      confidenceTier: "none",
      state: "unresolved",
      source: null,
      abstentionReason: "This value could not be read.",
    });
  });
});
