import { z } from "zod";
import { DocumentTypeSchema } from "./allowlist";

/** One requirement in the gold checklist (data/checklist/gold.json). */
export const ChecklistRequirementSchema = z.strictObject({
  requirement_id: z.string().min(1),
  title: z.string().min(1),
  /** Plain language, ~8th-grade reading level. */
  description: z.string().min(1),
  accepted_document_types: z.array(DocumentTypeSchema),
  /** Document date must be within this many days of "today"; null = no window. */
  freshness_days: z.number().int().positive().nullable(),
  /** How many matching documents are needed (e.g. 2 consecutive pay stubs). */
  min_count: z.number().int().positive(),
  /** "document" needs an upload; "attestation" is renter-stated (household size). */
  kind: z.enum(["document", "attestation"]),
});
export type ChecklistRequirement = z.infer<typeof ChecklistRequirementSchema>;

export const GoldChecklistFileSchema = z.strictObject({
  checklist_version: z.string().min(1),
  placeholder: z.boolean(),
  requirements: z.array(ChecklistRequirementSchema).min(1),
});
export type GoldChecklistFile = z.infer<typeof GoldChecklistFileSchema>;

/** Statuses are text + icon in the UI, never color-only (CLAUDE.md). */
export const ChecklistStatusSchema = z.enum([
  "confirmed",
  "needs_confirmation",
  "missing",
  "expired",
  "conflicting",
  "not_applicable",
]);
export type ChecklistStatus = z.infer<typeof ChecklistStatusSchema>;

export const ChecklistResultSchema = z.strictObject({
  requirement_id: z.string().min(1),
  requirement_version: z.string().min(1),
  status: ChecklistStatusSchema,
  /** Plain-language explanation of why, e.g. which date failed which window. */
  explanation: z.string().min(1),
  matched_document_ids: z.array(z.string()),
});
export type ChecklistResult = z.infer<typeof ChecklistResultSchema>;
