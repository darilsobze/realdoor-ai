/**
 * Deterministic calculation modules.
 * NO LLM MATH. Pure functions. Each carries a formulaVersion.
 * Comparison functions return {value, comparison} objects, never verdicts.
 */

import type { CalculationResult, ConfirmedField, RuleRecord } from "./types";

export const FORMULA_VERSIONS = {
  annualizePay: "annualize_pay@v1",
  documentExpiry: "document_expiry@v1",
  incomeVsThreshold: "income_vs_threshold@v1",
} as const;

/** Annualize a biweekly gross pay (26 pay periods per year). Simulated model. */
export function annualizeBiweeklyPay(grossPeriod: number): number {
  return Math.round(grossPeriod * 26 * 100) / 100;
}

export type IncomeComparison = {
  formulaVersion: string;
  annualIncome: number;
  householdSize: number;
  publishedLimit: number;
  /** neutral factual comparison — never a verdict */
  comparison:
    "below_published_limit" | "at_published_limit" | "above_published_limit" | "insufficient_data";
  differenceUSD: number | null;
  simulated: true;
};

export function compareIncomeToLimit(params: {
  annualIncome: number | null;
  householdSize: number | null;
  incomeLimitTable: Record<string, number>;
}): IncomeComparison {
  const { annualIncome, householdSize, incomeLimitTable } = params;
  if (annualIncome == null || householdSize == null || !incomeLimitTable[String(householdSize)]) {
    return {
      formulaVersion: FORMULA_VERSIONS.incomeVsThreshold,
      annualIncome: annualIncome ?? 0,
      householdSize: householdSize ?? 0,
      publishedLimit: 0,
      comparison: "insufficient_data",
      differenceUSD: null,
      simulated: true,
    };
  }
  const publishedLimit = incomeLimitTable[String(householdSize)];
  const diff = Math.round((publishedLimit - annualIncome) * 100) / 100;
  let comparison: IncomeComparison["comparison"];
  if (annualIncome < publishedLimit) comparison = "below_published_limit";
  else if (annualIncome === publishedLimit) comparison = "at_published_limit";
  else comparison = "above_published_limit";
  return {
    formulaVersion: FORMULA_VERSIONS.incomeVsThreshold,
    annualIncome,
    householdSize,
    publishedLimit,
    comparison,
    differenceUSD: diff,
    simulated: true,
  };
}

export type ExpiryStatus = {
  formulaVersion: string;
  isoDate: string | null;
  daysFromToday: number | null;
  status: "current" | "expiring_soon" | "expired" | "unknown";
  simulated: true;
};

export function documentExpiryStatus(
  isoDate: string | null,
  today: Date = new Date(),
): ExpiryStatus {
  if (!isoDate) {
    return {
      formulaVersion: FORMULA_VERSIONS.documentExpiry,
      isoDate: null,
      daysFromToday: null,
      status: "unknown",
      simulated: true,
    };
  }
  const then = new Date(isoDate + "T00:00:00Z").getTime();
  const now = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const days = Math.floor((then - now) / (1000 * 60 * 60 * 24));
  let status: ExpiryStatus["status"];
  if (days < 0) status = "expired";
  else if (days <= 60) status = "expiring_soon";
  else status = "current";
  return {
    formulaVersion: FORMULA_VERSIONS.documentExpiry,
    isoDate,
    daysFromToday: days,
    status,
    simulated: true,
  };
}

/**
 * Build a CalculationResult record from confirmed fields.
 * Returns null if inputs are insufficient — the UI shows an abstain state.
 */
export function buildAnnualIncomeCalculation(
  confirmedGross: ConfirmedField | undefined,
  ruleRef: RuleRecord | undefined,
): CalculationResult | null {
  if (!confirmedGross || typeof confirmedGross.value !== "number") return null;
  const gross = confirmedGross.value as number;
  const annual = annualizeBiweeklyPay(gross);
  return {
    id: `calc.annualize.${confirmedGross.fieldId}`,
    label: "Annualized gross income (from confirmed pay stub)",
    formulaVersion: FORMULA_VERSIONS.annualizePay,
    inputs: [
      {
        name: confirmedGross.name,
        value: gross,
        fieldId: confirmedGross.fieldId,
      },
    ],
    steps: [
      `gross_pay_period = $${gross.toFixed(2)} (renter-confirmed)`,
      `annual = gross_pay_period × 26 (biweekly pay periods per year)`,
      `annual = $${annual.toFixed(2)}`,
    ],
    result: { value: annual, unit: "USD/year" },
    ruleRefIds: ruleRef ? [ruleRef.id] : [],
    simulated: true,
  };
}
