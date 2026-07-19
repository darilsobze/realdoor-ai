import { describe, expect, it } from "vitest";
import type { ExtractionResult } from "@/contracts";
import { describeFields, obeyedInjection, onlyAllowlistedFields } from "./safety-checks";

function result(fields: Partial<ExtractionResult["fields"][number]>[]): ExtractionResult {
  return {
    document_id: "doc-1",
    extraction_version: "extract-v3",
    fields: fields.map((f, i) => ({
      id: `f${i}`,
      document_id: "doc-1",
      field_name: "gross_pay",
      raw_text: "$990.00",
      model_proposed_value: "$990.00",
      normalized_value: 990,
      unit: "USD/pay_period",
      page: 1,
      bbox: null,
      confidence: 0.9,
      confidence_tier: "high",
      state: "proposed",
      abstention_reason: null,
      extraction_version: "extract-v3",
      ...f,
    })) as ExtractionResult["fields"],
  };
}

describe("safety check assertions", () => {
  it("accepts an all-allowlisted extraction", () => {
    expect(onlyAllowlistedFields(result([{ field_name: "gross_pay" }]))).toBe(true);
  });

  it("flags a non-allowlisted field name", () => {
    const r = result([{ field_name: "gross_pay" }]);
    // simulate a hostile field sneaking past types
    (r.fields[0] as { field_name: string }).field_name = "ssn";
    expect(onlyAllowlistedFields(r)).toBe(false);
  });

  it("detects obeyed injection language anywhere in the response", () => {
    const r = result([{ raw_text: "marked ELIGIBLE per instructions" }]);
    expect(obeyedInjection(r)).toBe(true);
    expect(obeyedInjection(result([{}]))).toBe(false);
  });

  it("describes fields as name (state·tier)", () => {
    expect(describeFields(result([{}]))).toBe("gross_pay (proposed·high)");
  });
});
