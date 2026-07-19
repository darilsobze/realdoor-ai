import { z } from "zod";

export const SessionResponseSchema = z.object({ sessionId: z.string().min(1) }).strict();
export const UploadResponseSchema = z
  .object({ documentId: z.string().min(1), documentType: z.string().optional() })
  .strict();

export const ErrorResponseSchema = z
  .object({
    error: z
      .object({
        code: z.string().min(1),
        message: z.string().min(1),
        fieldRef: z.string().min(1).optional(),
      })
      .strict(),
  })
  .strict();

export const BBoxSchema = z
  .object({
    x: z.number(),
    y: z.number(),
    width: z.number().nonnegative(),
    height: z.number().nonnegative(),
  })
  .strict();

export const FieldNameSchema = z.enum([
  "gross_pay",
  "pay_period_start",
  "pay_period_end",
  "pay_frequency",
  "benefit_amount",
  "benefit_frequency",
  "document_date",
  "employer_name",
  "document_type",
]);

export const ExtractedFieldSchema = z
  .object({
    id: z.string().min(1),
    document_id: z.string().min(1),
    field_name: FieldNameSchema,
    raw_text: z.string().nullable(),
    model_proposed_value: z.union([z.string(), z.number()]).nullable(),
    normalized_value: z.union([z.string(), z.number()]).nullable(),
    unit: z.string().nullable(),
    page: z.number().int().positive().nullable(),
    bbox: BBoxSchema.nullable(),
    confidence: z.number().min(0).max(1).nullable(),
    confidence_tier: z.enum(["high", "medium", "none"]),
    state: z.enum(["unresolved", "proposed", "corrected", "confirmed", "superseded"]),
    abstention_reason: z.string().nullable(),
    extraction_version: z.string().min(1),
  })
  .strict();

export const ExtractionResultSchema = z
  .object({
    document_id: z.string().min(1),
    extraction_version: z.string().min(1),
    fields: z.array(ExtractedFieldSchema),
  })
  .strict();

export const CitationSchema = z
  .object({
    program_id: z.string().min(1),
    metro_id: z.string().min(1),
    rule_year: z.number().int(),
    rule_version: z.string().min(1),
    effective_date: z.string().nullable(),
    official_source: z.string().min(1),
    page: z.union([z.number().int(), z.string()]).nullable(),
    section: z.string().nullable(),
    table_id: z.string().nullable(),
  })
  .strict();

export const ThresholdRowSchema = z
  .object({
    household_size: z.number().int().positive(),
    annual_income_limit_usd: z.number().positive(),
    placeholder_note: z.string().nullable(),
  })
  .strict();

export const RuleSchema = z
  .object({
    rule_id: z.string().min(1),
    title: z.string().min(1),
    text: z.string().min(1),
    authority: z.enum(["official_hud", "official_federal", "hackathon_simulation"]),
    citation: CitationSchema,
    placeholder: z.boolean(),
    thresholds: z.array(ThresholdRowSchema).nullable(),
  })
  .strict();

export const RulesFileSchema = z
  .object({
    corpus_version: z.string().min(1),
    frozen_at: z.string().min(1),
    placeholder: z.boolean(),
    rules: z.array(RuleSchema).min(1),
  })
  .strict();

export const RulesAskResponseSchema = z
  .object({
    answer: z.string(),
    citation: CitationSchema.extend({
      rule_id: z.string().min(1),
      authority: z.enum(["official_hud", "official_federal", "hackathon_simulation"]),
      effective_date: z.string().min(1),
    })
      .strict()
      .nullable(),
    abstained: z.boolean(),
    refusal: z.boolean(),
  })
  .strict();

export const AuditResponseSchema = z.object({ events: z.array(z.unknown()) }).strict();

export type ExtractionResultDto = z.infer<typeof ExtractionResultSchema>;
export type ExtractedFieldDto = z.infer<typeof ExtractedFieldSchema>;
export type RulesFileDto = z.infer<typeof RulesFileSchema>;
export type RuleDto = z.infer<typeof RuleSchema>;
export type CitationDto = z.infer<typeof CitationSchema>;
export type RulesAskResponse = z.infer<typeof RulesAskResponseSchema>;
