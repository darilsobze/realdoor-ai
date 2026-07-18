import type { Frequency } from "../contracts/allowlist";
import type {
  BlockedCalculation,
  CalculationInput,
  CalculationResult,
  CalculationType,
  ComputedCalculation,
} from "../contracts/calculation";
import type { Rule } from "../contracts/rule";

const FORMULA_VERSION = "1.0.0";
const INCOME_RULE_ID = "CH-INCOME-001";

const ANNUAL_MULTIPLIER: Record<Exclude<Frequency, "unknown">, number> = {
  weekly: 52,
  biweekly: 26,
  semimonthly: 24,
  monthly: 12,
  annual: 1,
};

export interface CalculationContext {
  profileVersion: number;
  /** Supplied by the caller so the engine remains deterministic and pure. */
  computedAt: string;
}

export interface ConfirmedAmount {
  value: number | null;
  confirmed: boolean;
  sourceField: string;
}

export interface ConfirmedHouseholdSize {
  value: number | null;
  confirmed: boolean;
}

function blocked(
  calculationType: CalculationType,
  reasonCode: BlockedCalculation["reason_code"],
  explanation: string,
  blockingFields: string[],
): BlockedCalculation {
  return {
    status: "blocked",
    calculation_type: calculationType,
    reason_code: reasonCode,
    explanation,
    blocking_fields: blockingFields,
  };
}

function roundToCents(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function computed(
  calculationId: string,
  calculationType: CalculationType,
  context: CalculationContext,
  inputs: CalculationInput[],
  formula: string,
  resultValue: number,
  sourceRuleId: string | null,
): ComputedCalculation {
  return {
    status: "computed",
    calculation_id: calculationId,
    calculation_type: calculationType,
    profile_version: context.profileVersion,
    inputs,
    formula,
    formula_version: FORMULA_VERSION,
    rounding_rule: "half_up_to_cents",
    result_value: roundToCents(resultValue),
    result_unit: "USD/year",
    source_rule_id: sourceRuleId,
    computed_at: context.computedAt,
  };
}

export function annualize(
  amount: ConfirmedAmount,
  frequency: Frequency,
  context: CalculationContext,
): CalculationResult {
  if (!amount.confirmed) {
    return blocked(
      "annualized_income",
      "input_not_confirmed",
      `Cannot compute annual income until ${amount.sourceField} is confirmed.`,
      [amount.sourceField],
    );
  }

  if (amount.value === null || !Number.isFinite(amount.value)) {
    return blocked(
      "annualized_income",
      "input_missing",
      `Cannot compute annual income until ${amount.sourceField} is provided.`,
      [amount.sourceField],
    );
  }

  if (frequency === "unknown") {
    return blocked(
      "annualized_income",
      "frequency_unknown",
      "Cannot compute annual income until the income frequency is known.",
      [amount.sourceField.includes("benefit") ? "benefit_frequency" : "pay_frequency"],
    );
  }

  const multiplier = ANNUAL_MULTIPLIER[frequency];
  const result = roundToCents(amount.value * multiplier);
  const inputAmount = roundToCents(amount.value).toFixed(2);

  return computed(
    `annualize:${amount.sourceField}:v${context.profileVersion}`,
    "annualized_income",
    context,
    [
      { name: "amount", value: amount.value, unit: `USD/${frequency}`, source_field: amount.sourceField },
      { name: "periods_per_year", value: multiplier, unit: "periods/year", source_field: null },
    ],
    `${inputAmount} USD/${frequency} × ${multiplier} = ${result.toFixed(2)} USD/year`,
    result,
    INCOME_RULE_ID,
  );
}

export function sumIncomeSources(
  sources: CalculationResult[],
  context: CalculationContext,
): CalculationResult {
  if (sources.length === 0) {
    return blocked(
      "income_sum",
      "input_missing",
      "Cannot sum annual income until at least one confirmed income source is provided.",
      ["income_sources"],
    );
  }

  const blockedSource = sources.find((source) => source.status === "blocked");
  if (blockedSource?.status === "blocked") {
    return blocked(
      "income_sum",
      blockedSource.reason_code,
      `Cannot sum annual income: ${blockedSource.explanation}`,
      blockedSource.blocking_fields,
    );
  }

  const computedSources = sources as ComputedCalculation[];
  const values = computedSources.map((source) => source.result_value);
  const result = roundToCents(values.reduce((total, value) => total + value, 0));

  return computed(
    `income-sum:v${context.profileVersion}`,
    "income_sum",
    context,
    computedSources.map((source, index) => ({
      name: `annualized_income_${index + 1}`,
      value: source.result_value,
      unit: source.result_unit,
      source_field: source.inputs[0]?.source_field ?? null,
    })),
    `${values.map((value) => value.toFixed(2)).join(" + ")} = ${result.toFixed(2)} USD/year`,
    result,
    INCOME_RULE_ID,
  );
}

export function compareToThreshold(
  annualIncome: CalculationResult,
  rule: Rule,
  householdSize: ConfirmedHouseholdSize,
  context: CalculationContext,
): CalculationResult {
  if (annualIncome.status === "blocked") {
    return blocked(
      "threshold_comparison",
      annualIncome.reason_code,
      `Cannot compare with the published threshold: ${annualIncome.explanation}`,
      annualIncome.blocking_fields,
    );
  }

  if (!householdSize.confirmed) {
    return blocked(
      "threshold_comparison",
      "input_not_confirmed",
      "Cannot select a published threshold until household size is confirmed.",
      ["household_size"],
    );
  }

  if (householdSize.value === null) {
    return blocked(
      "threshold_comparison",
      "household_size_missing",
      "Cannot select a published threshold until household size is provided.",
      ["household_size"],
    );
  }

  const threshold = rule.thresholds?.find(
    (row) => row.household_size === householdSize.value,
  );
  if (!threshold) {
    return blocked(
      "threshold_comparison",
      "household_size_missing",
      "No published threshold exists in this rule for the provided household size.",
      ["household_size"],
    );
  }

  const difference = roundToCents(annualIncome.result_value - threshold.annual_income_limit_usd);
  return computed(
    `threshold-comparison:${rule.rule_id}:v${context.profileVersion}`,
    "threshold_comparison",
    context,
    [
      { name: "annual_income", value: annualIncome.result_value, unit: "USD/year", source_field: null },
      { name: "household_size", value: householdSize.value, unit: "people", source_field: "household_size" },
      { name: "published_threshold", value: threshold.annual_income_limit_usd, unit: "USD/year", source_field: null },
    ],
    `${annualIncome.result_value.toFixed(2)} USD/year − ${threshold.annual_income_limit_usd.toFixed(2)} USD/year = ${difference.toFixed(2)} USD/year difference`,
    difference,
    rule.rule_id,
  );
}
