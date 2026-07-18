import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ExtractedFieldSchema,
  FixtureManifestSchema,
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

// vitest runs with cwd = web/, so the repo root is one level up
const repoRoot = join(process.cwd(), "..");
const dataDir = join(repoRoot, "data");

describe("official frozen 2026 data files parse against contracts", () => {
  const rulesRaw = readFileSync(join(dataDir, "rules", "rules.json"), "utf8");
  const goldRaw = readFileSync(join(dataDir, "checklist", "gold.json"), "utf8");

  it("data/rules/rules.json is the official frozen corpus — no placeholders anywhere", () => {
    const parsed = RulesFileSchema.parse(JSON.parse(rulesRaw));
    expect(parsed.placeholder).toBe(false);
    expect(parsed.corpus_version).toBe("2026-frozen-2026-07-18");
    expect(rulesRaw).not.toMatch(/PLACEHOLDER/);
    for (const rule of parsed.rules) {
      expect(rule.placeholder).toBe(false);
      for (const row of rule.thresholds ?? []) {
        expect(row.placeholder_note).toBeNull();
      }
    }
  });

  it("carries the official FY2026 MTSP 60% table (frozen challenge threshold)", () => {
    const parsed = RulesFileSchema.parse(JSON.parse(rulesRaw));
    const table = parsed.rules.find((r) => r.citation.table_id === "mtsp-2026-60pct");
    expect(table).toBeDefined();
    expect(table?.authority).toBe("official_hud");
    expect(table?.citation.effective_date).toBe("2026-05-01");
    expect(table?.citation.page).toBe(130);
    expect(table?.citation.official_source).toMatch(/huduser\.gov/);
    // Official 60% limits, household sizes 1-8, from mtsp_2026_boston_cambridge_quincy.csv
    expect(table?.thresholds?.map((t) => t.annual_income_limit_usd)).toEqual([
      72000, 82320, 92580, 102840, 111120, 119340, 127560, 135780,
    ]);
    const fifty = parsed.rules.find((r) => r.citation.table_id === "mtsp-2026-50pct");
    expect(fifty?.thresholds?.map((t) => t.annual_income_limit_usd)).toEqual([
      60000, 68600, 77150, 85700, 92600, 99450, 106300, 113150,
    ]);
  });

  it("preserves corpus metadata: every rule has an authority and dated rules keep their dates", () => {
    const parsed = RulesFileSchema.parse(JSON.parse(rulesRaw));
    const byId = new Map(parsed.rules.map((r) => [r.rule_id, r]));
    expect(byId.get("CH-DECISION-001")?.authority).toBe("hackathon_simulation");
    expect(byId.get("CH-DECISION-001")?.citation.effective_date).toBe("2026-07-18");
    expect(byId.get("FED-LIHTC-001")?.authority).toBe("official_federal");
    // Undated statute stays undated — no invented effective date.
    expect(byId.get("FED-LIHTC-001")?.citation.effective_date).toBeNull();
    expect(byId.get("HUD-MTSP-001")?.citation.effective_date).toBe("2026-05-01");
  });

  it("data/checklist/gold.json is the organizer checklist with the 60-day currency convention", () => {
    const parsed = GoldChecklistFileSchema.parse(JSON.parse(goldRaw));
    expect(parsed.placeholder).toBe(false);
    expect(goldRaw).not.toMatch(/PLACEHOLDER/);
    const ids = parsed.requirements.map((r) => r.requirement_id);
    expect(ids).toEqual([
      "application_summary",
      "pay_stubs_recent",
      "employment_letter",
      "benefit_letter_current",
      "gig_income_corroboration",
      "household_size_confirmation",
    ]);
    for (const r of parsed.requirements) {
      if (r.kind === "document") expect(r.freshness_days).toBe(60);
    }
    const stubs = parsed.requirements.find((r) => r.requirement_id === "pay_stubs_recent");
    expect(stubs?.min_count).toBe(2);
  });
});

describe("fixture manifest points at the organizer documents", () => {
  const manifest = FixtureManifestSchema.parse(
    JSON.parse(readFileSync(join(dataDir, "synthetic-docs", "manifest.json"), "utf8")),
  );

  it("lists the 24 organizer PDFs plus injection.pdf and conflict.pdf", () => {
    expect(manifest.fixtures).toHaveLength(26);
    expect(manifest.fixtures.filter((f) => f.source === "organizer")).toHaveLength(24);
    const generated = manifest.fixtures.filter((f) => f.source === "generated");
    expect(generated.map((f) => f.path).sort()).toEqual([
      "data/synthetic-docs/conflict.pdf",
      "data/synthetic-docs/injection.pdf",
    ]);
    const ids = manifest.fixtures.map((f) => f.fixture_id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every referenced fixture file and gold file exists on disk", () => {
    for (const f of manifest.fixtures) {
      expect(existsSync(join(repoRoot, f.path)), f.path).toBe(true);
      if (f.gold_source) expect(existsSync(join(repoRoot, f.gold_source))).toBe(true);
    }
    expect(existsSync(join(repoRoot, manifest.organizer_gold_file))).toBe(true);
  });

  it("organizer fixtures carry household + gold linkage; adversarial ones are flagged", () => {
    for (const f of manifest.fixtures) {
      if (f.source === "organizer") {
        expect(f.household_id).toMatch(/^HH-\d{3}$/);
        expect(f.gold_source).not.toBeNull();
      }
    }
    const injection = manifest.fixtures.find((f) => f.fixture_id === "ADV-INJECTION");
    expect(injection?.contains_adversarial_text).toBe(true);
  });
});
