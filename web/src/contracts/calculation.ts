import { z } from "zod";

export const CalculationTypeSchema = z.enum([
  "annualized_income",
  "income_sum",
  "threshold_comparison",
]);
export type CalculationType = z.infer<typeof CalculationTypeSchema>;

export const CalculationInputSchema = z.strictObject({
  name: z.string().min(1),
  value: z.union([z.string(), z.number()]),
  unit: z.string().nullable(),
  /** Which confirmed profile field supplied this input, when applicable. */
  source_field: z.string().nullable(),
});
export type CalculationInput = z.infer<typeof CalculationInputSchema>;

/**
 * A completed deterministic calculation. Records everything needed to
 * reproduce it: inputs, formula string, versions, rounding, source rule.
 * Produced ONLY by web/src/engine/ — the LLM never computes these.
 */
export const ComputedCalculationSchema = z.strictObject({
  status: z.literal("computed"),
  calculation_id: z.string().min(1),
  calculation_type: CalculationTypeSchema,
  /** Profile version the inputs came from; stale if the profile moved on. */
  profile_version: z.number().int().nonnegative(),
  inputs: z.array(CalculationInputSchema).min(1),
  /** Human-readable, e.g. "1580.00 USD/biweekly × 26 = 41080.00 USD/year" */
  formula: z.string().min(1),
  formula_version: z.string().min(1),
  rounding_rule: z.enum(["none", "half_up_to_cents"]),
  result_value: z.number(),
  result_unit: z.string().min(1),
  source_rule_id: z.string().nullable(),
  computed_at: z.string().min(1),
});
export type ComputedCalculation = z.infer<typeof ComputedCalculationSchema>;

/**
 * A calculation that must not run: unconfirmed input, unknown frequency,
 * or missing data. Blocking is correct behavior, styled as info, not error.
 */
export const BlockedCalculationSchema = z.strictObject({
  status: z.literal("blocked"),
  calculation_type: CalculationTypeSchema,
  reason_code: z.enum([
    "input_not_confirmed",
    "frequency_unknown",
    "input_missing",
    "household_size_missing",
  ]),
  /** Plain language: "Cannot compute annual income until gross pay is confirmed." */
  explanation: z.string().min(1),
  /** Which fields the renter must confirm/provide to unblock. */
  blocking_fields: z.array(z.string().min(1)),
});
export type BlockedCalculation = z.infer<typeof BlockedCalculationSchema>;

export const CalculationResultSchema = z.discriminatedUnion("status", [
  ComputedCalculationSchema,
  BlockedCalculationSchema,
]);
export type CalculationResult = z.infer<typeof CalculationResultSchema>;
