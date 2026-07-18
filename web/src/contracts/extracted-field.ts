import { z } from "zod";
import { FieldNameSchema } from "./allowlist";
import { ConfidenceTierSchema, FieldStateSchema } from "./field-state";

/** Source geometry in PDF points, page origin top-left. */
export const BBoxSchema = z.strictObject({
  x: z.number(),
  y: z.number(),
  width: z.number().nonnegative(),
  height: z.number().nonnegative(),
});
export type BBox = z.infer<typeof BBoxSchema>;

/**
 * One candidate field from extraction. STRICT: unknown keys reject the
 * whole object — this is the allowlist enforcement boundary.
 * An abstained field has state "unresolved", tier "none", null value/bbox,
 * and a human-readable abstention_reason.
 */
export const ExtractedFieldSchema = z.strictObject({
  id: z.string().min(1),
  document_id: z.string().min(1),
  field_name: FieldNameSchema,
  /** Verbatim text the value was read from (null when abstained). */
  raw_text: z.string().nullable(),
  /** The model's output, never overwritten by corrections. */
  model_proposed_value: z.union([z.string(), z.number()]).nullable(),
  /** Deterministically normalized (money → number, dates → ISO). */
  normalized_value: z.union([z.string(), z.number()]).nullable(),
  unit: z.string().nullable(),
  page: z.number().int().positive().nullable(),
  bbox: BBoxSchema.nullable(),
  /** 0–1; shown to renters as words first (High / Medium / Could not read). */
  confidence: z.number().min(0).max(1).nullable(),
  confidence_tier: ConfidenceTierSchema,
  state: FieldStateSchema,
  abstention_reason: z.string().nullable(),
  extraction_version: z.string().min(1),
});
export type ExtractedField = z.infer<typeof ExtractedFieldSchema>;

export const ExtractionResultSchema = z.strictObject({
  document_id: z.string().min(1),
  extraction_version: z.string().min(1),
  fields: z.array(ExtractedFieldSchema),
});
export type ExtractionResult = z.infer<typeof ExtractionResultSchema>;
