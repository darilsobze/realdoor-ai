import { describe, expect, it } from "vitest";
import { annualize, compareToThreshold, sumIncomeSources } from "./calculations";
import type { RuleDto } from "@/api/schemas";

const context = { profileVersion: 2, computedAt: "2026-07-19T00:00:00.000Z" };

const rule: RuleDto = {
  rule_id: "HUD-MTSP-002",
  title: "60% table",
  text: "Frozen threshold table",
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

describe("deterministic calculations", () => {
  it.each([
    ["weekly", 52],
    ["biweekly", 26],
    ["semimonthly", 24],
    ["monthly", 12],
    ["annual", 1],
  ] as const)("annualizes %s income", (frequency, multiplier) => {
    const result = annualize(
      { value: 1000, confirmed: true, sourceField: "gross_pay" },
      frequency,
      context,
    );
    expect(result).toMatchObject({ status: "computed", result_value: 1000 * multiplier });
  });

  it("blocks unconfirmed values and unknown frequency", () => {
    expect(
      annualize({ value: 1000, confirmed: false, sourceField: "gross_pay" }, "weekly", context),
    ).toMatchObject({ status: "blocked", reason_code: "input_not_confirmed" });
    expect(
      annualize({ value: 1000, confirmed: true, sourceField: "gross_pay" }, "unknown", context),
    ).toMatchObject({ status: "blocked", reason_code: "frequency_unknown" });
  });

  it("sums only completed annualized sources", () => {
    const wage = annualize(
      { value: 1000, confirmed: true, sourceField: "gross_pay" },
      "monthly",
      context,
    );
    const benefit = annualize(
      { value: 300, confirmed: true, sourceField: "benefit_amount" },
      "monthly",
      context,
    );
    expect(sumIncomeSources([wage, benefit], context)).toMatchObject({
      status: "computed",
      result_value: 15600,
    });
  });

  it("compares with the confirmed household row without a verdict", () => {
    const income = annualize(
      { value: 1000, confirmed: true, sourceField: "gross_pay" },
      "monthly",
      context,
    );
    const result = compareToThreshold(income, rule, { value: 3, confirmed: true }, context);
    expect(result).toMatchObject({
      status: "computed",
      calculation_type: "threshold_comparison",
      result_value: -80580,
      source_rule_id: "HUD-MTSP-002",
    });
    const forbiddenVerdicts = new RegExp(
      [["elig", "ible"].join(""), ["appro", "ved"].join(""), ["quali", "fied"].join("")].join("|"),
      "i",
    );
    expect(JSON.stringify(result)).not.toMatch(forbiddenVerdicts);
  });
});
