export type Frequency = "weekly" | "biweekly" | "semimonthly" | "monthly" | "annual" | "unknown";

export type CalculationType = "annualized_income" | "income_sum" | "threshold_comparison";

export type CalculationInput = {
  name: string;
  value: string | number;
  unit: string | null;
  source_field: string | null;
};

export type ComputedCalculation = {
  status: "computed";
  calculation_id: string;
  calculation_type: CalculationType;
  profile_version: number;
  inputs: CalculationInput[];
  formula: string;
  formula_version: string;
  rounding_rule: "half_up_to_cents";
  result_value: number;
  result_unit: "USD/year";
  source_rule_id: string | null;
  computed_at: string;
};

export type BlockedCalculation = {
  status: "blocked";
  calculation_type: CalculationType;
  reason_code:
    | "input_not_confirmed"
    | "frequency_unknown"
    | "input_missing"
    | "household_size_missing"
    | "conflicting_input";
  explanation: string;
  blocking_fields: string[];
};

export type CalculationResult = ComputedCalculation | BlockedCalculation;

export type CalculationContext = {
  profileVersion: number;
  computedAt: string;
};
