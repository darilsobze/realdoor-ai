import { describe, expect, it } from "vitest";
import type { ExtractedField } from "@/contracts";
import type { ReviewField } from "@/store/review";
import { SCORED_RULE } from "./rules";
import { buildDerived, diffOutputs, withCorrection } from "./calculations";

const context = { profileVersion: 2, computedAt: "2026-07-19T12:00:00.000Z" };

function field(
  name: ExtractedField["field_name"],
  state: ReviewField["state"],
  confirmedValue: string | number | null,
): ReviewField {
  return {
    extracted: {
      id: `id-${name}`,
      document_id: "doc-1",
      field_name: name,
      raw_text: String(confirmedValue ?? ""),
      model_proposed_value: confirmedValue,
      normalized_value: confirmedValue,
      unit: null,
      page: 1,
      bbox: null,
      confidence: 0.9,
      confidence_tier: "high",
      state: "proposed",
      abstention_reason: null,
      extraction_version: "extract-v3",
    },
    state,
    correctedValue: null,
    confirmedValue,
    correctedAt: null,
    confirmedAt: state === "confirmed" ? context.computedAt : null,
    wasCorrected: false,
  };
}

const household = { value: 3, confirmedAt: "2026-07-19T11:00:00.000Z" };

describe("buildDerived — unconfirmed values never reach calculations", () => {
  it("blocks annualization while gross pay is only proposed", () => {
    const derived = buildDerived(
      [field("gross_pay", "proposed", null), field("pay_frequency", "confirmed", "biweekly")],
      household,
      SCORED_RULE,
      context,
    );
    expect(derived.wage?.status).toBe("blocked");
    expect(derived.wage?.status === "blocked" && derived.wage.reason_code).toBe(
      "input_not_confirmed",
    );
    expect(derived.comparison?.status).toBe("blocked");
  });

  it("blocks on unknown frequency even with confirmed gross pay", () => {
    const derived = buildDerived(
      [field("gross_pay", "confirmed", 1580), field("pay_frequency", "proposed", null)],
      household,
      SCORED_RULE,
      context,
    );
    expect(derived.wage?.status).toBe("blocked");
    expect(derived.wage?.status === "blocked" && derived.wage.reason_code).toBe(
      "frequency_unknown",
    );
  });

  it("computes the full chain from confirmed values only", () => {
    const derived = buildDerived(
      [field("gross_pay", "confirmed", 1580), field("pay_frequency", "confirmed", "biweekly")],
      household,
      SCORED_RULE,
      context,
    );
    expect(derived.wage?.status).toBe("computed");
    expect(derived.wage?.status === "computed" && derived.wage.result_value).toBe(41080);
    expect(derived.comparison?.status).toBe("computed");
    // 41080 - 92580 (3-person 60% MTSP limit) = -51500
    expect(derived.comparison?.status === "computed" && derived.comparison.result_value).toBe(
      -51500,
    );
    expect(
      derived.comparison?.status === "computed" && derived.comparison.source_rule_id,
    ).toBe("HUD-MTSP-002");
  });

  it("parses renter-typed money strings", () => {
    const derived = buildDerived(
      [field("gross_pay", "confirmed", "$1,620.00"), field("pay_frequency", "confirmed", "biweekly")],
      household,
      SCORED_RULE,
      context,
    );
    expect(derived.wage?.status === "computed" && derived.wage.result_value).toBe(42120);
  });

  it("blocks comparison until household size is confirmed", () => {
    const derived = buildDerived(
      [field("gross_pay", "confirmed", 1580), field("pay_frequency", "confirmed", "biweekly")],
      { value: null, confirmedAt: null },
      SCORED_RULE,
      context,
    );
    expect(derived.comparison?.status).toBe("blocked");
    expect(
      derived.comparison?.status === "blocked" && derived.comparison.blocking_fields,
    ).toContain("household_size");
  });
});

describe("diffOutputs — the real recompute list", () => {
  const fields = [
    field("gross_pay", "confirmed", 1580),
    field("pay_frequency", "confirmed", "biweekly"),
    field("document_date", "proposed", null),
  ];

  it("lists income chain + packet when gross pay is corrected", () => {
    const before = buildDerived(fields, household, SCORED_RULE, context);
    const after = buildDerived(
      withCorrection(fields, "id-gross_pay", "1620.00"),
      household,
      SCORED_RULE,
      context,
    );
    const outputs = diffOutputs(before, after);
    expect(outputs).toEqual([
      "Annualized income",
      "Total annual income",
      "Income vs. limit comparison",
      "Application packet",
    ]);
  });

  it("lists only the packet for a field no calculation consumes (no document)", () => {
    const before = buildDerived(fields, household, SCORED_RULE, context);
    const after = buildDerived(
      withCorrection(fields, "id-document_date", "2026-06-16"),
      household,
      SCORED_RULE,
      context,
    );
    expect(diffOutputs(before, after)).toEqual(["Application packet"]);
  });
});

describe("checklist wiring (single confirmed-profile source)", () => {
  const docFields = [
    field("document_type", "confirmed", "pay_stub"),
    field("document_date", "proposed", null),
  ];

  it("unconfirmed document date → pay stubs requirement needs_confirmation, never expired", () => {
    const derived = buildDerived(docFields, household, SCORED_RULE, context, "doc-1");
    const stubs = derived.checklist.find((r) => r.requirement_id === "pay_stubs_recent");
    expect(stubs?.status).toBe("needs_confirmation");
  });

  it("confirming the document date recomputes checklist rows in the diff", () => {
    const before = buildDerived(docFields, household, SCORED_RULE, context, "doc-1");
    const after = buildDerived(
      withCorrection(docFields, "id-document_date", "2026-07-10"),
      household,
      SCORED_RULE,
      context,
      "doc-1",
    );
    const outputs = diffOutputs(before, after);
    expect(outputs.some((o) => o.startsWith("Checklist:"))).toBe(true);
    expect(outputs).toContain("Application packet");
  });

  it("renter-typed US dates normalize for the freshness check", () => {
    const after = buildDerived(
      withCorrection(docFields, "id-document_date", "07/10/2026"),
      household,
      SCORED_RULE,
      context,
      "doc-1",
    );
    // 2026-07-10 is inside the 60-day window of the 2026-07-19 as-of date:
    // one current stub of two required → missing (not expired, not unconfirmed).
    const stubs = after.checklist.find((r) => r.requirement_id === "pay_stubs_recent");
    expect(stubs?.status).toBe("missing");
  });

  it("household-size confirmation flips the attestation row", () => {
    const before = buildDerived(docFields, { value: null, confirmedAt: null }, SCORED_RULE, context, "doc-1");
    const beforeRow = before.checklist.find((r) => r.requirement_id === "household_size_confirmation");
    expect(beforeRow?.status).toBe("needs_confirmation");
    const after = buildDerived(docFields, household, SCORED_RULE, context, "doc-1");
    const afterRow = after.checklist.find((r) => r.requirement_id === "household_size_confirmation");
    expect(afterRow?.status).toBe("confirmed");
  });
});
