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

function fieldEvidence(field: ProfileField): string {
  if (!field.source_document_id || !field.page) return "evidence reference unavailable";
  if (!field.bbox) return `${field.source_document_id}, page ${field.page}`;
  const { x, y, width, height } = field.bbox;
  return `${field.source_document_id}, page ${field.page}, box ${x},${y},${width},${height}`;
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

/** Canonical section content. The HTML preview and PDF renderer share this. */
export function buildPacketSections(packet: Packet): PacketSection[] {
  const sections: PacketSection[] = [
    {
      name: "Cover",
      lines: [packet.cover.title, `Prepared: ${packet.cover.prepared_on}`, packet.cover.disclaimer],
    },
    {
      name: "Confirmed values",
      lines:
        packet.confirmed_fields.length > 0
          ? packet.confirmed_fields.map(
              (field) =>
                `${field.field_name}: ${String(field.confirmed_value)} (${fieldEvidence(field)})`,
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
                `${calculation.calculation_type}: ${calculation.formula}`,
                `Formula ${calculation.formula_version}; rounding: ${calculation.rounding_rule}; rule: ${calculation.source_rule_id ?? "none"}`,
              ];
              if (citation) {
                lines.push(
                  `Citation: ${citation.official_source}; ${citation.section ?? "section not listed"}; page ${citation.page ?? "not listed"}; effective ${citation.effective_date ?? "corpus freeze date"}`,
                );
              }
              return lines;
            })
          : ["No completed calculations."],
    },
    {
      name: "Checklist",
      lines: packet.checklist.map(
        (item) =>
          `${item.requirement_id} - ${item.status}: ${item.explanation} Matched documents: ${item.matched_document_ids.join(", ") || "none"}.`,
      ),
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
        `Included documents: ${packet.manifest.included_document_ids.join(", ") || "none"}`,
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
