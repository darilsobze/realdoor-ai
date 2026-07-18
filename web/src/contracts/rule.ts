import { z } from "zod";

/** Full citation carried by every rule (CLAUDE.md data model rules). */
export const CitationSchema = z.strictObject({
  program_id: z.string().min(1),
  metro_id: z.string().min(1),
  rule_year: z.number().int(),
  rule_version: z.string().min(1),
  effective_date: z.string().min(1),
  official_source: z.string().min(1),
  page: z.union([z.number().int(), z.string()]).nullable(),
  section: z.string().nullable(),
  table_id: z.string().nullable(),
});
export type Citation = z.infer<typeof CitationSchema>;

export const ThresholdRowSchema = z.strictObject({
  household_size: z.number().int().min(1).max(8),
  annual_income_limit_usd: z.number().positive(),
  /** Present on every number until the official 2026 MTSP table is swapped in. */
  placeholder_note: z.string().nullable(),
});
export type ThresholdRow = z.infer<typeof ThresholdRowSchema>;

export const RuleSchema = z.strictObject({
  rule_id: z.string().min(1),
  title: z.string().min(1),
  /** Plain-language rule text served to the Q&A corpus. */
  text: z.string().min(1),
  citation: CitationSchema,
  /** true until official tables replace the numbers — never present as official. */
  placeholder: z.boolean(),
  thresholds: z.array(ThresholdRowSchema).nullable(),
});
export type Rule = z.infer<typeof RuleSchema>;

export const RulesFileSchema = z.strictObject({
  corpus_version: z.string().min(1),
  frozen_at: z.string().min(1),
  placeholder: z.boolean(),
  rules: z.array(RuleSchema).min(1),
});
export type RulesFile = z.infer<typeof RulesFileSchema>;
