import { z } from "zod";
import { DocumentTypeSchema } from "./allowlist";

/**
 * One entry in the canonical fixture set (data/synthetic-docs/manifest.json):
 * the organizer's 24 frozen synthetic documents plus our generated adversarial
 * fixtures (injection.pdf, conflict.pdf). Paths are repo-root-relative.
 */
export const FixtureSchema = z.strictObject({
  fixture_id: z.string().min(1),
  path: z.string().min(1),
  document_type: DocumentTypeSchema,
  /** "organizer" = frozen starter-pack document; "generated" = ours. */
  source: z.enum(["organizer", "generated"]),
  /** Organizer household the document belongs to; null for generated fixtures. */
  household_id: z.string().nullable(),
  /** True when the page is a raster (degraded scan) rather than vector text. */
  rasterized: z.boolean(),
  /** True when the document embeds prompt-injection / adversarial text. */
  contains_adversarial_text: z.boolean(),
  /** Repo-root-relative path to the gold extraction record, if one exists. */
  gold_source: z.string().nullable(),
});
export type Fixture = z.infer<typeof FixtureSchema>;

export const FixtureManifestSchema = z.strictObject({
  manifest_version: z.string().min(1),
  /** Where the organizer gold records live (document-level field gold). */
  organizer_gold_file: z.string().min(1),
  fixtures: z.array(FixtureSchema).min(1),
});
export type FixtureManifest = z.infer<typeof FixtureManifestSchema>;
