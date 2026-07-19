import type { RuleDto } from "@/api/schemas";
import type { ConfirmedField, FieldName } from "@/domain/types";
import { annualize, compareToThreshold, sumIncomeSources } from "./calculations";
import type { CalculationResult, Frequency } from "./types";

export type ProfileCalculations = {
  wage: CalculationResult | null;
  benefit: CalculationResult | null;
  totalIncome: CalculationResult | null;
  comparison: CalculationResult | null;
};

function values(fields: ConfirmedField[], name: FieldName): Array<string | number> {
  return fields
    .filter(
      (field) =>
        field.name === name && (field.status === "confirmed" || field.status === "corrected"),
    )
    .map((field) => field.value);
}

function conflict(field: string): CalculationResult {
  return {
    status: "blocked",
    calculation_type: "annualized_income",
    reason_code: "conflicting_input",
    explanation: `Cannot compute annual income until conflicting ${field} values are reviewed.`,
    blocking_fields: [field],
  };
}

function numberValue(input: string | number | undefined): number | null {
  if (input === undefined) return null;
  const number = typeof input === "number" ? input : Number(input.replace(/[$,\s]/g, ""));
  return Number.isFinite(number) ? number : null;
}

function frequencyValue(input: string | number | undefined): Frequency {
  const value = String(input ?? "unknown").toLowerCase();
  return ["weekly", "biweekly", "semimonthly", "monthly", "annual"].includes(value)
    ? (value as Frequency)
    : "unknown";
}

export function buildProfileCalculations(params: {
  confirmedFields: ConfirmedField[];
  householdSize: number | null;
  householdConfirmed: boolean;
  profileVersion: number;
  computedAt: string;
  rule: RuleDto;
}): ProfileCalculations {
  const context = {
    profileVersion: params.profileVersion,
    computedAt: params.computedAt,
  };
  const grossValues = values(params.confirmedFields, "gross_pay");
  const payFrequencies = values(params.confirmedFields, "pay_frequency");
  const benefitValues = values(params.confirmedFields, "benefit_amount");
  const benefitFrequencies = values(params.confirmedFields, "benefit_frequency");

  const wage =
    grossValues.length === 0
      ? null
      : new Set(grossValues.map(String)).size > 1
        ? conflict("gross_pay")
        : annualize(
            { value: numberValue(grossValues[0]), confirmed: true, sourceField: "gross_pay" },
            new Set(payFrequencies.map(String)).size > 1
              ? "unknown"
              : frequencyValue(payFrequencies[0]),
            context,
          );

  const benefit =
    benefitValues.length === 0
      ? null
      : new Set(benefitValues.map(String)).size > 1
        ? conflict("benefit_amount")
        : annualize(
            {
              value: numberValue(benefitValues[0]),
              confirmed: true,
              sourceField: "benefit_amount",
            },
            new Set(benefitFrequencies.map(String)).size > 1
              ? "unknown"
              : frequencyValue(benefitFrequencies[0]),
            context,
          );

  const sources = [wage, benefit].filter(
    (calculation): calculation is CalculationResult => calculation !== null,
  );
  const totalIncome = sources.length > 0 ? sumIncomeSources(sources, context) : null;
  const comparison = totalIncome
    ? compareToThreshold(
        totalIncome,
        params.rule,
        { value: params.householdSize, confirmed: params.householdConfirmed },
        context,
      )
    : null;

  return { wage, benefit, totalIncome, comparison };
}
