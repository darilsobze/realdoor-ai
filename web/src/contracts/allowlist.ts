import { z } from "zod";

/**
 * THE extraction field allowlist. Extraction may return ONLY these fields;
 * anything else is rejected at schema validation (this is also the
 * prompt-injection boundary). Replace only when the organizer data
 * dictionary is swapped in (Phase 9).
 */
export const FIELD_ALLOWLIST = [
  "gross_pay",
  "pay_period_start",
  "pay_period_end",
  "pay_frequency",
  "benefit_amount",
  "benefit_frequency",
  "document_date",
  "employer_name",
  "document_type",
] as const;

export const FieldNameSchema = z.enum(FIELD_ALLOWLIST);
export type FieldName = z.infer<typeof FieldNameSchema>;

/** Frequencies the deterministic engine can annualize. "unknown" blocks annualization. */
export const FrequencySchema = z.enum([
  "weekly",
  "biweekly",
  "semimonthly",
  "monthly",
  "annual",
  "unknown",
]);
export type Frequency = z.infer<typeof FrequencySchema>;

export const DocumentTypeSchema = z.enum([
  "pay_stub",
  "benefit_letter",
  "employment_letter",
  "gig_statement",
  "utility_bill",
  "bank_statement",
  "lease",
  "photo_id",
  "application_summary",
  "other",
]);
export type DocumentType = z.infer<typeof DocumentTypeSchema>;
