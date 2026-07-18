// Plain-language field labels (~8th-grade reading level, design brief) and the
// static dependency map that powers the "What will update" preview. In C4 the
// engine replaces this map with the real recompute list.
import type { FieldName } from "@/contracts";

export const FIELD_META: Record<FieldName, { label: string; helper: string }> = {
  gross_pay: {
    label: "Gross pay",
    helper: "Money you earned before taxes, for one pay period.",
  },
  pay_period_start: {
    label: "Pay period start",
    helper: "The first day this pay stub covers.",
  },
  pay_period_end: {
    label: "Pay period end",
    helper: "The last day this pay stub covers.",
  },
  pay_frequency: {
    label: "Pay frequency",
    helper: "How often you get paid.",
  },
  benefit_amount: {
    label: "Benefit amount",
    helper: "The benefit payment stated on your award letter.",
  },
  benefit_frequency: {
    label: "Benefit frequency",
    helper: "How often the benefit is paid.",
  },
  document_date: {
    label: "Document date",
    helper: "The date printed on the document.",
  },
  employer_name: {
    label: "Employer",
    helper: "Who you work for, as printed on the document.",
  },
  document_type: {
    label: "Document type",
    helper: "What kind of document this is.",
  },
};

/** Outputs recomputed when a field changes — shown before the renter confirms. */
export const FIELD_DEPENDENTS: Record<FieldName, string[]> = {
  gross_pay: [
    "Annualized income",
    "Income vs. limit comparison",
    "Checklist: two recent pay stubs",
    "Application packet",
  ],
  pay_frequency: [
    "Annualized income",
    "Income vs. limit comparison",
    "Application packet",
  ],
  pay_period_start: ["Checklist: two recent pay stubs", "Application packet"],
  pay_period_end: ["Checklist: two recent pay stubs", "Application packet"],
  benefit_amount: [
    "Annualized income",
    "Income vs. limit comparison",
    "Checklist: benefit award letter",
    "Application packet",
  ],
  benefit_frequency: [
    "Annualized income",
    "Income vs. limit comparison",
    "Application packet",
  ],
  document_date: ["Checklist: document freshness", "Application packet"],
  employer_name: ["Application packet"],
  document_type: ["Checklist: document matching", "Application packet"],
};

const MONEY_FIELDS: FieldName[] = ["gross_pay", "benefit_amount"];
const DATE_FIELDS: FieldName[] = ["pay_period_start", "pay_period_end", "document_date"];

/** Display formatting only — no arithmetic, no unit conversion. */
export function formatValue(field: FieldName, value: string | number | null): string {
  if (value === null) return "—";
  if (MONEY_FIELDS.includes(field)) {
    // Renter-typed corrections arrive as strings ("1620.00", "$1,620") —
    // format them like extracted numbers so cards and previews match.
    const n =
      typeof value === "number" ? value : Number(String(value).replace(/[$,\s]/g, ""));
    if (Number.isFinite(n)) {
      return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
    }
  }
  if (DATE_FIELDS.includes(field) && typeof value === "string") {
    const m = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) {
      return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    }
  }
  if (field === "pay_frequency" || field === "benefit_frequency") {
    const words: Record<string, string> = {
      weekly: "Weekly",
      biweekly: "Every two weeks",
      semimonthly: "Twice a month",
      monthly: "Monthly",
      annual: "Yearly",
      unknown: "Unknown",
    };
    return words[String(value)] ?? String(value);
  }
  if (field === "document_type") {
    const words = String(value).replaceAll("_", " ");
    return words.charAt(0).toUpperCase() + words.slice(1);
  }
  return String(value);
}
