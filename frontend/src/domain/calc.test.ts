import { describe, it, expect } from "vitest";
import {
  annualizeBiweeklyPay,
  buildAnnualIncomeCalculation,
  compareIncomeToLimit,
  documentExpiryStatus,
  FORMULA_VERSIONS,
} from "./calc";
import type { ConfirmedField, RuleRecord } from "./types";

describe("annualizeBiweeklyPay", () => {
  it("multiplies by 26 (biweekly periods)", () => {
    expect(annualizeBiweeklyPay(1000)).toBe(26000);
    expect(annualizeBiweeklyPay(1538.46)).toBeCloseTo(39999.96, 2);
  });
});

describe("compareIncomeToLimit", () => {
  const table = { "1": 42000, "2": 48000, "3": 54000 };
  it("returns below_published_limit when income < limit", () => {
    const r = compareIncomeToLimit({
      annualIncome: 30000,
      householdSize: 2,
      incomeLimitTable: table,
    });
    expect(r.comparison).toBe("below_published_limit");
    expect(r.differenceUSD).toBe(18000);
  });
  it("returns at_published_limit when equal", () => {
    const r = compareIncomeToLimit({
      annualIncome: 48000,
      householdSize: 2,
      incomeLimitTable: table,
    });
    expect(r.comparison).toBe("at_published_limit");
    expect(r.differenceUSD).toBe(0);
  });
  it("returns above_published_limit and negative signed diff", () => {
    const r = compareIncomeToLimit({
      annualIncome: 60000,
      householdSize: 2,
      incomeLimitTable: table,
    });
    expect(r.comparison).toBe("above_published_limit");
    expect(r.differenceUSD).toBe(-12000);
  });
  it("returns insufficient_data on missing input", () => {
    const r = compareIncomeToLimit({
      annualIncome: null,
      householdSize: 2,
      incomeLimitTable: table,
    });
    expect(r.comparison).toBe("insufficient_data");
    expect(r.differenceUSD).toBeNull();
  });
  it("returns insufficient_data when household size not in table", () => {
    const r = compareIncomeToLimit({
      annualIncome: 30000,
      householdSize: 99,
      incomeLimitTable: table,
    });
    expect(r.comparison).toBe("insufficient_data");
  });
});

describe("documentExpiryStatus", () => {
  const today = new Date("2025-10-15T00:00:00Z");
  it("expired for past dates", () => {
    expect(documentExpiryStatus("2024-03-01", today).status).toBe("expired");
  });
  it("expiring_soon within 60 days", () => {
    expect(documentExpiryStatus("2025-11-01", today).status).toBe("expiring_soon");
  });
  it("current far in the future", () => {
    expect(documentExpiryStatus("2027-01-01", today).status).toBe("current");
  });
  it("unknown when null", () => {
    expect(documentExpiryStatus(null, today).status).toBe("unknown");
  });
});

describe("buildAnnualIncomeCalculation", () => {
  const rule: RuleRecord = {
    id: "rule.income_limits",
    program: "P",
    year: "2025",
    ruleVersion: "2025.v1",
    section: "s",
    title: "t",
    bodyText: "b",
    sourceUrl: "u",
    effectiveDate: "2025-04-01",
    simulated: true,
    limitations: [],
  };
  const cf: ConfirmedField = {
    fieldId: "f.paystub.gross",
    docId: "doc.paystub.1",
    name: "gross_pay_period",
    status: "confirmed",
    value: 1000,
    correctedFromProposed: false,
    confirmedAt: new Date().toISOString(),
  };
  it("returns null on missing input", () => {
    expect(buildAnnualIncomeCalculation(undefined, rule)).toBeNull();
  });
  it("computes annualized value and carries formulaVersion", () => {
    const r = buildAnnualIncomeCalculation(cf, rule)!;
    expect(r.result.value).toBe(26000);
    expect(r.formulaVersion).toBe(FORMULA_VERSIONS.annualizePay);
    expect(r.ruleRefIds).toEqual(["rule.income_limits"]);
    expect(r.simulated).toBe(true);
  });
});
