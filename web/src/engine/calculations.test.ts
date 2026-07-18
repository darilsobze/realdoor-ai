import { describe, expect, it } from "vitest";
import type { Frequency } from "../contracts/allowlist";
import { CalculationResultSchema } from "../contracts/calculation";
import type { Rule } from "../contracts/rule";
import { annualize, compareToThreshold, sumIncomeSources } from "./calculations";

const context = { profileVersion: 3, computedAt: "2026-07-19T10:00:00.000Z" };
const amount = { value: 1_000, confirmed: true, sourceField: "gross_pay" };

const thresholdRule: Rule = {
  rule_id: "HUD-MTSP-002",
  title: "60% MTSP limits",
  text: "Published frozen thresholds.",
  authority: "official_hud",
  citation: {
    program_id: "LIHTC",
    metro_id: "boston_cambridge_quincy_ma_nh_hmfa",
    rule_year: 2026,
    rule_version: "2026-frozen-2026-07-18",
    effective_date: "2026-05-01",
    official_source: "https://example.test/rule.pdf",
    page: 130,
    section: "table",
    table_id: "mtsp-2026-60pct",
  },
  placeholder: false,
  thresholds: [{ household_size: 2, annual_income_limit_usd: 82_320, placeholder_note: null }],
};

describe("annualize", () => {
  it.each<[Frequency, number]>([
    ["weekly", 52_000],
    ["biweekly", 26_000],
    ["semimonthly", 24_000],
    ["monthly", 12_000],
    ["annual", 1_000],
  ])("annualizes %s income", (frequency, expected) => {
    const result = annualize(amount, frequency, context);
    expect(result).toMatchObject({ status: "computed", result_value: expected });
    expect(CalculationResultSchema.safeParse(result).success).toBe(true);
  });

  it("rounds half up to cents and records reproducibility metadata", () => {
    const result = annualize({ ...amount, value: 10.005 }, "annual", context);
    expect(result).toMatchObject({
      status: "computed",
      profile_version: 3,
      formula_version: "1.0.0",
      rounding_rule: "half_up_to_cents",
      result_value: 10.01,
      source_rule_id: "CH-INCOME-001",
      computed_at: context.computedAt,
    });
  });

  it("blocks unconfirmed amounts", () => {
    expect(annualize({ ...amount, confirmed: false }, "weekly", context)).toEqual({
      status: "blocked",
      calculation_type: "annualized_income",
      reason_code: "input_not_confirmed",
      explanation: "Cannot compute annual income until gross_pay is confirmed.",
      blocking_fields: ["gross_pay"],
    });
  });

  it("blocks missing amounts", () => {
    expect(annualize({ ...amount, value: null }, "weekly", context)).toMatchObject({
      status: "blocked",
      reason_code: "input_missing",
    });
  });

  it("blocks unknown frequencies", () => {
    expect(annualize(amount, "unknown", context)).toMatchObject({
      status: "blocked",
      reason_code: "frequency_unknown",
      blocking_fields: ["pay_frequency"],
    });
  });
});

describe("sumIncomeSources", () => {
  it("sums independently annualized sources", () => {
    const pay = annualize(amount, "monthly", context);
    const benefit = annualize(
      { value: 500, confirmed: true, sourceField: "benefit_amount" },
      "monthly",
      context,
    );
    const result = sumIncomeSources([pay, benefit], context);
    expect(result).toMatchObject({ status: "computed", result_value: 18_000 });
    expect(CalculationResultSchema.safeParse(result).success).toBe(true);
  });

  it("blocks an empty source list", () => {
    expect(sumIncomeSources([], context)).toMatchObject({
      status: "blocked",
      reason_code: "input_missing",
    });
  });

  it("propagates a blocked source without using partial income", () => {
    const blocked = annualize(amount, "unknown", context);
    expect(sumIncomeSources([blocked], context)).toMatchObject({
      status: "blocked",
      reason_code: "frequency_unknown",
    });
  });
});

describe("compareToThreshold", () => {
  const annualIncome = annualize({ ...amount, value: 7_000 }, "monthly", context);

  it("records the numeric difference without an eligibility conclusion", () => {
    const result = compareToThreshold(
      annualIncome,
      thresholdRule,
      { value: 2, confirmed: true },
      context,
    );
    expect(result).toMatchObject({
      status: "computed",
      result_value: 1_680,
      source_rule_id: "HUD-MTSP-002",
    });
    expect(result).not.toHaveProperty("eligible");
    expect(CalculationResultSchema.safeParse(result).success).toBe(true);
  });

  it("blocks an unconfirmed household size", () => {
    expect(
      compareToThreshold(annualIncome, thresholdRule, { value: 2, confirmed: false }, context),
    ).toMatchObject({ status: "blocked", reason_code: "input_not_confirmed" });
  });

  it("blocks a missing household size", () => {
    expect(
      compareToThreshold(annualIncome, thresholdRule, { value: null, confirmed: true }, context),
    ).toMatchObject({ status: "blocked", reason_code: "household_size_missing" });
  });

  it("blocks when the rule has no row for the household size", () => {
    expect(
      compareToThreshold(annualIncome, thresholdRule, { value: 3, confirmed: true }, context),
    ).toMatchObject({ status: "blocked", reason_code: "household_size_missing" });
  });

  it("propagates a blocked annual income", () => {
    const blockedIncome = annualize(amount, "unknown", context);
    expect(
      compareToThreshold(blockedIncome, thresholdRule, { value: 2, confirmed: true }, context),
    ).toMatchObject({ status: "blocked", reason_code: "frequency_unknown" });
  });
});
