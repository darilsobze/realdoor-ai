import {
  DISCLAIMER_TEXT,
  PacketSchema,
  type ChecklistResult,
  type ComputedCalculation,
  type Citation,
  type Packet,
  type ProfileField,
} from "../contracts";

export const PACKET_SECTIONS = [
  "Cover",
  "Confirmed values",
  "Calculation sheet",
  "Checklist",
  "Unresolved items",
  "Manifest",
] as const;

export interface BuildPacketInput {
  createdAt: string;
  profileVersion: number;
  ruleVersion: string;
  checklistVersion: string;
  confirmedFields: ProfileField[];
  calculations: ComputedCalculation[];
  citations: Citation[];
  checklist: ChecklistResult[];
  selectedDocumentIds: string[];
  unresolvedItems: string[];
}

export interface PacketSection {
  name: (typeof PACKET_SECTIONS)[number];
  lines: string[];
}

/**
 * Display lookups the UI supplies so the printed packet reads in plain
 * language (labels, formatted values, document names, dates) WITHOUT the
 * engine importing any UI/formatting code. Every function is optional and
 * falls back to the raw value — the pure engine stays presentation-free.
 */
export interface PacketPresentation {
  fieldLabel: (fieldName: string) => string;
  formatValue: (fieldName: string, value: string | number) => string;
  documentName: (documentId: string) => string;
  requirementTitle: (requirementId: string) => string;
  statusLabel: (status: string) => string;
  calculationLabel: (calculationType: string) => string;
  formatDate: (value: string) => string;
}

const IDENTITY: PacketPresentation = {
  fieldLabel: (f) => f,
  formatValue: (_f, v) => String(v),
  documentName: (id) => id,
  requirementTitle: (id) => id,
  statusLabel: (s) => s,
  calculationLabel: (t) => t,
  formatDate: (s) => s,
};

function resolvePresentation(p?: Partial<PacketPresentation>): PacketPresentation {
  return p ? { ...IDENTITY, ...p } : IDENTITY;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

/** Assemble and validate the single packet record consumed by both renderers. */
export function buildPacket(input: BuildPacketInput): Packet {
  const packet: Packet = {
    manifest: {
      created_at: input.createdAt,
      profile_version: input.profileVersion,
      rule_version: input.ruleVersion,
      checklist_version: input.checklistVersion,
      included_document_ids: unique(input.selectedDocumentIds),
      sections: [...PACKET_SECTIONS],
      unresolved_items: unique(input.unresolvedItems),
    },
    cover: {
      title: "RealDoor application review packet",
      prepared_on: input.createdAt,
      disclaimer: DISCLAIMER_TEXT,
    },
    confirmed_fields: input.confirmedFields.filter((field) => field.state === "confirmed"),
    calculations: input.calculations,
    citations: input.citations,
    checklist: input.checklist,
  };

  return PacketSchema.parse(packet);
}

/** Where a confirmed value was read — a page reference (print-appropriate;
 *  the exact source box lives in the on-screen evidence view, not the packet). */
function fieldEvidence(field: ProfileField, present: PacketPresentation): string {
  if (!field.source_document_id || !field.page) return "confirmed by the renter";
  return `from ${present.documentName(field.source_document_id)}, page ${field.page}`;
}

function citationFor(calculation: ComputedCalculation, citations: Citation[]): Citation | undefined {
  if (!calculation.source_rule_id) return undefined;
  return citations.find((citation) => citation.table_id === calculation.source_rule_id) ??
    citations.find((citation) => citation.rule_version === calculation.source_rule_id) ??
    citations.find((citation) =>
      calculation.source_rule_id === "HUD-MTSP-002"
        ? citation.table_id === "mtsp-2026-60pct"
        : citation.section === "Frozen challenge convention",
    );
}

/**
 * Canonical section content. The HTML preview and PDF renderer share this,
 * so passing the same `presentation` to both keeps them identical (parity =
 * same sections, values, order, manifest). With no presentation the output
 * is raw — the engine never depends on UI formatting.
 */
export function buildPacketSections(
  packet: Packet,
  presentation?: Partial<PacketPresentation>,
): PacketSection[] {
  const p = resolvePresentation(presentation);
  const sections: PacketSection[] = [
    {
      name: "Cover",
      lines: [
        packet.cover.title,
        `Prepared ${p.formatDate(packet.cover.prepared_on)}`,
        packet.cover.disclaimer,
      ],
    },
    {
      name: "Confirmed values",
      lines:
        packet.confirmed_fields.length > 0
          ? packet.confirmed_fields.map(
              (field) =>
                `${p.fieldLabel(field.field_name)}: ${p.formatValue(field.field_name, field.confirmed_value ?? "")} — ${fieldEvidence(field, p)}`,
            )
          : ["No confirmed values."],
    },
    {
      name: "Calculation sheet",
      lines:
        packet.calculations.length > 0
          ? packet.calculations.flatMap((calculation) => {
              const citation = citationFor(calculation, packet.citations);
              const lines = [
                `${p.calculationLabel(calculation.calculation_type)}: ${calculation.formula}`,
                `Method: formula ${calculation.formula_version}, ${calculation.rounding_rule.replaceAll("_", " ")}, rule ${calculation.source_rule_id ?? "none"}`,
              ];
              if (citation) {
                lines.push(
                  `Source: ${citation.official_source} — ${citation.section ?? "section not listed"}, page ${citation.page ?? "not listed"}, effective ${p.formatDate(citation.effective_date ?? packet.manifest.created_at)}`,
                );
              }
              return lines;
            })
          : ["No completed calculations."],
    },
    {
      name: "Checklist",
      lines: packet.checklist.map((item) => {
        const matched = item.matched_document_ids.map(p.documentName).join(", ");
        const suffix = matched ? ` Matched: ${matched}.` : "";
        return `${p.requirementTitle(item.requirement_id)} — ${p.statusLabel(item.status)}: ${item.explanation}${suffix}`;
      }),
    },
    {
      name: "Unresolved items",
      lines:
        packet.manifest.unresolved_items.length > 0
          ? packet.manifest.unresolved_items
          : ["No unresolved items."],
    },
    {
      name: "Manifest",
      lines: [
        `Profile version: ${packet.manifest.profile_version}`,
        `Rule version: ${packet.manifest.rule_version}`,
        `Checklist version: ${packet.manifest.checklist_version}`,
        `Included documents: ${packet.manifest.included_document_ids.map(p.documentName).join(", ") || "none"}`,
        `Sections: ${packet.manifest.sections.join(" > ")}`,
      ],
    },
  ];

  const sectionNames = sections.map((section) => section.name);
  if (JSON.stringify(sectionNames) !== JSON.stringify(packet.manifest.sections)) {
    throw new Error("Packet section order does not match its manifest.");
  }
  return sections;
}
