import { describe, expect, it } from "vitest";
import { buildProfileCalculations } from "./profile";
import type { RuleDto } from "@/api/schemas";
import type { ConfirmedField } from "@/domain/types";

const rule: RuleDto = {
  rule_id: "HUD-MTSP-002",
  title: "60% MTSP limits",
  text: "Official frozen table",
  authority: "official_hud",
  placeholder: false,
  citation: {
    program_id: "LIHTC",
    metro_id: "boston",
    rule_year: 2026,
    rule_version: "2026-frozen",
    effective_date: "2026-05-01",
    official_source: "https://hud.example/table.pdf",
    page: 130,
    section: "Boston table",
    table_id: "mtsp-2026-60pct",
  },
  thresholds: [{ household_size: 3, annual_income_limit_usd: 92580, placeholder_note: null }],
};

function confirmed(name: ConfirmedField["name"], value: string | number): ConfirmedField {
  return {
    fieldId: `field-${name}`,
    docId: "doc-1",
    name,
    status: "confirmed",
    value,
    correctedFromProposed: false,
    confirmedAt: "2026-07-19T00:00:00.000Z",
  };
}

describe("profile calculations", () => {
  it("uses confirmed amount, frequency, household size, and official rule", () => {
    const result = buildProfileCalculations({
      confirmedFields: [confirmed("gross_pay", 1580), confirmed("pay_frequency", "biweekly")],
      householdSize: 3,
      householdConfirmed: true,
      profileVersion: 2,
      computedAt: "2026-07-19T00:00:00.000Z",
      rule,
    });

    expect(result.wage).toMatchObject({ status: "computed", result_value: 41080 });
    expect(result.comparison).toMatchObject({ status: "computed", result_value: -51500 });
  });

  it("blocks conflicting confirmed values instead of choosing one", () => {
    const result = buildProfileCalculations({
      confirmedFields: [
        confirmed("gross_pay", 1580),
        { ...confirmed("gross_pay", 1600), fieldId: "field-gross-2", docId: "doc-2" },
        confirmed("pay_frequency", "biweekly"),
      ],
      householdSize: 3,
      householdConfirmed: true,
      profileVersion: 3,
      computedAt: "2026-07-19T00:00:00.000Z",
      rule,
    });

    expect(result.wage).toMatchObject({ status: "blocked", reason_code: "conflicting_input" });
    expect(result.comparison).toMatchObject({ status: "blocked" });
  });
});
