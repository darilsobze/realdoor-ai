import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ExtractedFieldSchema,
  GoldChecklistFileSchema,
  RulesFileSchema,
} from "./index";

const validField = {
  id: "f1",
  document_id: "doc1",
  field_name: "gross_pay",
  raw_text: "$1,580.00",
  model_proposed_value: "1580.00",
  normalized_value: 1580,
  unit: "USD/pay_period",
  page: 1,
  bbox: { x: 100, y: 200, width: 80, height: 14 },
  confidence: 0.98,
  confidence_tier: "high",
  state: "proposed",
  abstention_reason: null,
  extraction_version: "extract-v1",
};

describe("ExtractedField allowlist enforcement", () => {
  it("accepts a valid allowlisted field", () => {
    expect(ExtractedFieldSchema.parse(validField)).toBeTruthy();
  });

  it("rejects a non-allowlisted field name (e.g. ssn)", () => {
    expect(() =>
      ExtractedFieldSchema.parse({ ...validField, field_name: "ssn" }),
    ).toThrow();
  });

  it("rejects fields the schema does not know (strict) — injection boundary", () => {
    expect(() =>
      ExtractedFieldSchema.parse({
        ...validField,
        send_documents_to: "attacker@example.com",
      }),
    ).toThrow();
  });

  it("accepts an abstained field with no value, no bbox, and a reason", () => {
    expect(
      ExtractedFieldSchema.parse({
        ...validField,
        raw_text: null,
        model_proposed_value: null,
        normalized_value: null,
        unit: null,
        page: null,
        bbox: null,
        confidence: null,
        confidence_tier: "none",
        state: "unresolved",
        abstention_reason: "Value not legible in the document.",
      }),
    ).toBeTruthy();
  });

  it("rejects out-of-range confidence", () => {
    expect(() =>
      ExtractedFieldSchema.parse({ ...validField, confidence: 1.7 }),
    ).toThrow();
  });
});

// vitest runs with cwd = web/, so the repo-level data/ dir is one level up
const dataDir = join(process.cwd(), "..", "data");

describe("placeholder data files parse against contracts", () => {
  it("data/rules/rules.json is a valid RulesFile with placeholder markers", () => {
    const parsed = RulesFileSchema.parse(
      JSON.parse(readFileSync(join(dataDir, "rules", "rules.json"), "utf8")),
    );
    expect(parsed.placeholder).toBe(true);
    for (const rule of parsed.rules) {
      expect(rule.placeholder).toBe(true);
      for (const row of rule.thresholds ?? []) {
        expect(row.placeholder_note).toMatch(/PLACEHOLDER/);
      }
    }
    const table = parsed.rules.find((r) => r.thresholds);
    expect(table?.thresholds).toHaveLength(6);
  });

  it("data/checklist/gold.json is a valid gold checklist with 5 requirements", () => {
    const parsed = GoldChecklistFileSchema.parse(
      JSON.parse(readFileSync(join(dataDir, "checklist", "gold.json"), "utf8")),
    );
    expect(parsed.requirements).toHaveLength(5);
    const ids = parsed.requirements.map((r) => r.requirement_id);
    expect(ids).toContain("pay_stubs_recent");
    expect(ids).toContain("household_size_confirmation");
    const address = parsed.requirements.find(
      (r) => r.requirement_id === "address_verification",
    );
    expect(address?.freshness_days).toBe(90);
  });
});
