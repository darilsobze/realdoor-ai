import type { FieldName } from "./types";

const LABELS: Partial<Record<FieldName, string>> = {
  gross_pay: "Gross pay",
  pay_period_start: "Pay period start",
  pay_period_end: "Pay period end",
  pay_frequency: "Pay frequency",
  benefit_amount: "Benefit amount",
  benefit_frequency: "Benefit frequency",
  document_date: "Document date",
  employer_name: "Employer",
  document_type: "Document type",
};

export function fieldLabel(name: FieldName): string {
  return LABELS[name] ?? name.replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase());
}
