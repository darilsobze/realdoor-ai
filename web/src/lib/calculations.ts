// Assembles Emmanuel's pure engine functions over the review store's fields.
// No caching: callers recompute from the store on every change — corrections
// propagate because there is nothing else to read. The "what will update"
// preview diffs REAL calculation records, not a hardcoded dependency map.
import {
  annualize,
  compareToThreshold,
  evaluateChecklist,
  sumIncomeSources,
  type CalculationContext,
  type ChecklistDocumentMetadata,
} from "@/engine";
import {
  DocumentTypeSchema,
  FrequencySchema,
  type CalculationResult,
  type ChecklistResult,
  type Frequency,
  type Rule,
} from "@/contracts";
import { GOLD_CHECKLIST, requirementTitle } from "@/lib/checklist";
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
  checklist: ChecklistResult[];
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

/** "06/16/2026" or ISO → "YYYY-MM-DD"; null when unparseable (engine then
 *  asks for confirmation rather than judging freshness on a bad date). */
function toIsoDate(value: string | number | null): string | null {
  if (value === null) return null;
  const s = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const us = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (us) return `${us[3]}-${us[1].padStart(2, "0")}-${us[2].padStart(2, "0")}`;
  return null;
}

/** Session documents as checklist metadata — confirmed values only count as
 *  confirmed; proposed types/dates flow through flagged unconfirmed. */
export function buildChecklistDocuments(
  fields: ReviewField[],
  documentId: string | null,
): ChecklistDocumentMetadata[] {
  if (!documentId) return [];
  const byName = new Map(fields.map((f) => [f.extracted.field_name, f]));
  const typeField = byName.get("document_type");
  const dateField = byName.get("document_date");

  const typeConfirmed = typeField?.state === "confirmed";
  const rawType = typeConfirmed
    ? typeField?.confirmedValue
    : (typeField?.extracted.normalized_value ?? null);
  const parsedType = DocumentTypeSchema.safeParse(
    String(rawType ?? "").toLowerCase().trim().replaceAll(" ", "_"),
  );

  const dateConfirmed = dateField?.state === "confirmed";
  const rawDate = dateConfirmed
    ? dateField?.confirmedValue
    : (dateField?.extracted.normalized_value ?? null);

  return [
    {
      documentId,
      documentType: parsedType.success ? parsedType.data : "other",
      documentTypeConfirmed: typeConfirmed && parsedType.success,
      documentDate: toIsoDate(rawDate ?? null),
      documentDateConfirmed: dateConfirmed,
      conflicting: false, // cross-document conflict detection arrives with multi-doc support
    },
  ];
}

export function buildDerived(
  fields: ReviewField[],
  householdSize: HouseholdSizeState,
  rule: Rule,
  context: CalculationContext,
  documentId: string | null = null,
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

  const checklist = evaluateChecklist({
    checklist: GOLD_CHECKLIST,
    documents: buildChecklistDocuments(fields, documentId),
    attestations: { householdSizeConfirmed: householdSize.confirmedAt !== null },
    asOfDate: context.computedAt.slice(0, 10),
  });

  return { wage, benefit, totalIncome, comparison, checklist };
}

const CALC_LABELS = {
  wage: "Annualized income",
  benefit: "Annualized benefit income",
  totalIncome: "Total annual income",
  comparison: "Income vs. limit comparison",
} as const;

/**
 * Which outputs actually change between two derived states — the real
 * recompute list shown in "What will update" and counted in the toast.
 * Checklist rows diff per requirement. "Application packet" is always
 * included: it renders confirmed values, so any confirmation changes it.
 */
export function diffOutputs(before: DerivedOutputs, after: DerivedOutputs): string[] {
  const changed: string[] = [];
  for (const key of Object.keys(CALC_LABELS) as (keyof typeof CALC_LABELS)[]) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      changed.push(CALC_LABELS[key]);
    }
  }
  const beforeRows = new Map(before.checklist.map((r) => [r.requirement_id, r]));
  for (const row of after.checklist) {
    if (JSON.stringify(beforeRows.get(row.requirement_id)) !== JSON.stringify(row)) {
      changed.push(`Checklist: ${requirementTitle(row.requirement_id)}`);
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
