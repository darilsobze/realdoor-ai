import { z } from "zod";
import { ComputedCalculationSchema } from "./calculation";
import { ChecklistResultSchema } from "./checklist";
import { ProfileFieldSchema } from "./profile";
import { CitationSchema } from "./rule";

export const DISCLAIMER_TEXT =
  "This packet is not an eligibility decision. It organizes your confirmed " +
  "information, the published rules, and the documents you chose to include " +
  "so a qualified person at the housing office can review your application.";

/** What ships in the download — and the acceptance check for preview parity. */
export const PacketManifestSchema = z.strictObject({
  created_at: z.string().min(1),
  profile_version: z.number().int().nonnegative(),
  rule_version: z.string().min(1),
  checklist_version: z.string().min(1),
  /** Renter-selected only; never auto-included. */
  included_document_ids: z.array(z.string()),
  /** Section names in render order — preview and PDF must agree on these. */
  sections: z.array(z.string().min(1)).min(1),
  unresolved_items: z.array(z.string()),
});
export type PacketManifest = z.infer<typeof PacketManifestSchema>;

export const PacketSchema = z.strictObject({
  manifest: PacketManifestSchema,
  cover: z.strictObject({
    title: z.string().min(1),
    prepared_on: z.string().min(1),
    disclaimer: z.string().min(1),
  }),
  confirmed_fields: z.array(ProfileFieldSchema),
  calculations: z.array(ComputedCalculationSchema),
  citations: z.array(CitationSchema),
  checklist: z.array(ChecklistResultSchema),
});
export type Packet = z.infer<typeof PacketSchema>;
