// Assembles Emmanuel's pure engine functions over the review store's fields.
// No caching: callers recompute from the store on every change — corrections
// propagate because there is nothing else to read. The "what will update"
// preview diffs REAL calculation records, not a hardcoded dependency map.
import {
  annualize,
  compareToThreshold,
  sumIncomeSources,
  type CalculationContext,
} from "@/engine";
import {
  FrequencySchema,
  type CalculationResult,
  type Frequency,
  type Rule,
} from "@/contracts";
import type { ReviewField } from "@/store/review";

export interface HouseholdSizeState {
  value: number | null;
  confirmedAt: string | null;
}

export interface DerivedOutputs {
  /** null = this income type has no field rows in the session at all. */
  wage: CalculationResult | null;
  benefit: CalculationResult | null;
  totalIncome: CalculationResult | null;
  comparison: CalculationResult | null;
}

/** Only confirmed values leave this function — everything else is null. */
function confirmedNumber(field: ReviewField | undefined): number | null {
  if (!field || field.state !== "confirmed" || field.confirmedValue === null) return null;
  const n =
    typeof field.confirmedValue === "number"
      ? field.confirmedValue
      : Number(String(field.confirmedValue).replace(/[$,\s]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function confirmedFrequency(field: ReviewField | undefined): Frequency {
  if (!field || field.state !== "confirmed" || field.confirmedValue === null) return "unknown";
  const parsed = FrequencySchema.safeParse(String(field.confirmedValue).toLowerCase().trim());
  return parsed.success ? parsed.data : "unknown";
}

export function buildDerived(
  fields: ReviewField[],
  householdSize: HouseholdSizeState,
  rule: Rule,
  context: CalculationContext,
): DerivedOutputs {
  const byName = new Map(fields.map((f) => [f.extracted.field_name, f]));

  const wage = byName.has("gross_pay")
    ? annualize(
        {
          value: confirmedNumber(byName.get("gross_pay")),
          confirmed: byName.get("gross_pay")?.state === "confirmed",
          sourceField: "gross_pay",
        },
        confirmedFrequency(byName.get("pay_frequency")),
        context,
      )
    : null;

  const benefit = byName.has("benefit_amount")
    ? annualize(
        {
          value: confirmedNumber(byName.get("benefit_amount")),
          confirmed: byName.get("benefit_amount")?.state === "confirmed",
          sourceField: "benefit_amount",
        },
        confirmedFrequency(byName.get("benefit_frequency")),
        context,
      )
    : null;

  const sources = [wage, benefit].filter((s): s is CalculationResult => s !== null);
  const totalIncome = sources.length > 0 ? sumIncomeSources(sources, context) : null;

  const comparison = totalIncome
    ? compareToThreshold(
        totalIncome,
        rule,
        { value: householdSize.value, confirmed: householdSize.confirmedAt !== null },
        context,
      )
    : null;

  return { wage, benefit, totalIncome, comparison };
}

const OUTPUT_LABELS: Record<keyof DerivedOutputs, string> = {
  wage: "Annualized income",
  benefit: "Annualized benefit income",
  totalIncome: "Total annual income",
  comparison: "Income vs. limit comparison",
};

/**
 * Which outputs actually change between two derived states — the real
 * recompute list shown in "What will update" and counted in the toast.
 * "Application packet" is always included: it renders confirmed values, so
 * any confirmation changes it.
 */
export function diffOutputs(before: DerivedOutputs, after: DerivedOutputs): string[] {
  const changed: string[] = [];
  for (const key of Object.keys(OUTPUT_LABELS) as (keyof DerivedOutputs)[]) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      changed.push(OUTPUT_LABELS[key]);
    }
  }
  changed.push("Application packet");
  return changed;
}

/** A hypothetical post-correction field list (for previews — store unchanged). */
export function withCorrection(
  fields: ReviewField[],
  fieldId: string,
  correctedValue: string,
): ReviewField[] {
  return fields.map((f) =>
    f.extracted.id === fieldId
      ? { ...f, state: "confirmed" as const, confirmedValue: correctedValue, wasCorrected: true }
      : f,
  );
}
