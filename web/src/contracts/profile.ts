import { z } from "zod";
import { FieldNameSchema } from "./allowlist";
import { BBoxSchema } from "./extracted-field";
import { ConfidenceTierSchema, FieldStateSchema } from "./field-state";

/**
 * One field in the profile. model_proposed_value, user_corrected_value and
 * confirmed_value are SEPARATE properties — the model's original output is
 * never overwritten (CLAUDE.md data model rules).
 */
export const ProfileFieldSchema = z.strictObject({
  field_name: FieldNameSchema,
  state: FieldStateSchema,
  confidence_tier: ConfidenceTierSchema,
  model_proposed_value: z.union([z.string(), z.number()]).nullable(),
  user_corrected_value: z.union([z.string(), z.number()]).nullable(),
  /** Only this value may feed calculations, and only in state "confirmed". */
  confirmed_value: z.union([z.string(), z.number()]).nullable(),
  unit: z.string().nullable(),
  proposed_at: z.string().nullable(),
  corrected_at: z.string().nullable(),
  confirmed_at: z.string().nullable(),
  /** Evidence link — exact source box in the original document. */
  extracted_field_id: z.string().nullable(),
  source_document_id: z.string().nullable(),
  page: z.number().int().positive().nullable(),
  bbox: BBoxSchema.nullable(),
});
export type ProfileField = z.infer<typeof ProfileFieldSchema>;

export const ChangeLogEntrySchema = z.strictObject({
  version: z.number().int().nonnegative(),
  timestamp: z.string(),
  /** e.g. ["gross_pay"] or ["household_size"] */
  changed: z.array(z.string().min(1)).min(1),
  /** Plain-language names of outputs recomputed by this change. */
  recomputed_outputs: z.array(z.string()),
});
export type ChangeLogEntry = z.infer<typeof ChangeLogEntrySchema>;

/**
 * The single confirmed-profile store. ALL derived values (annualization,
 * comparison, checklist, packet) are computed from this — never cached.
 */
export const ConfirmedProfileSchema = z.strictObject({
  session_id: z.string().min(1),
  /** Monotonic; bumps exactly once per confirmed change. Drives the change-log UX. */
  profile_version: z.number().int().nonnegative(),
  fields: z.partialRecord(FieldNameSchema, ProfileFieldSchema),
  /** Renter-stated, not extracted (feature register: table-row selection only). */
  household_size: z.strictObject({
    value: z.number().int().min(1).max(8).nullable(),
    confirmed_at: z.string().nullable(),
  }),
  change_log: z.array(ChangeLogEntrySchema),
});
export type ConfirmedProfile = z.infer<typeof ConfirmedProfileSchema>;
