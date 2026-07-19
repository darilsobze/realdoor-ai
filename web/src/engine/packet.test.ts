import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import {
  ChecklistResultSchema,
  ComputedCalculationSchema,
  PacketSchema,
  ProfileFieldSchema,
  type Citation,
} from "../contracts";
import { buildPacket, buildPacketSections, PACKET_SECTIONS } from "./packet";
import { renderPacketPdf } from "./packet-pdf";

const createdAt = "2026-07-19T12:00:00.000Z";
const citation: Citation = {
  program_id: "LIHTC",
  metro_id: "boston_cambridge_quincy_ma_nh_hmfa",
  rule_year: 2026,
  rule_version: "2026-frozen-2026-07-18",
  effective_date: "2026-05-01",
  official_source: "https://www.huduser.gov/example.pdf",
  page: 130,
  section: "FY 2026 table",
  table_id: "mtsp-2026-60pct",
};

const field = ProfileFieldSchema.parse({
  field_name: "gross_pay",
  state: "confirmed",
  confidence_tier: "high",
  model_proposed_value: 1580,
  user_corrected_value: null,
  confirmed_value: 1580,
  unit: "USD",
  proposed_at: createdAt,
  corrected_at: null,
  confirmed_at: createdAt,
  extracted_field_id: "FIELD-1",
  source_document_id: "DOC-1",
  page: 1,
  bbox: { x: 10, y: 20, width: 30, height: 12 },
});

const calculation = ComputedCalculationSchema.parse({
  status: "computed",
  calculation_id: "CALC-1",
  calculation_type: "annualized_income",
  profile_version: 4,
  inputs: [{ name: "amount", value: 1580, unit: "USD/biweekly", source_field: "gross_pay" }],
  formula: "1580.00 USD/biweekly × 26 = 41080.00 USD/year",
  formula_version: "1.0.0",
  rounding_rule: "half_up_to_cents",
  result_value: 41080,
  result_unit: "USD/year",
  source_rule_id: "HUD-MTSP-002",
  computed_at: createdAt,
});

const checklistItem = ChecklistResultSchema.parse({
  requirement_id: "pay_stubs_recent",
  requirement_version: "application_checklists_2026-frozen-2026-07-18",
  status: "needs_confirmation",
  explanation: "A second pay stub still needs confirmation.",
  matched_document_ids: ["DOC-1"],
});

function packet(selectedDocumentIds: string[] = ["DOC-1"]) {
  return buildPacket({
    createdAt,
    profileVersion: 4,
    ruleVersion: citation.rule_version,
    checklistVersion: checklistItem.requirement_version,
    confirmedFields: [field],
    calculations: [calculation],
    citations: [citation],
    checklist: [checklistItem],
    selectedDocumentIds,
    unresolvedItems: ["pay_frequency needs confirmation"],
  });
}

describe("packet assembly and parity", () => {
  it("returns a frozen-contract-valid packet", () => {
    expect(PacketSchema.safeParse(packet()).success).toBe(true);
  });

  it("filters non-confirmed fields and removes duplicate selections", () => {
    const unconfirmed = { ...field, state: "proposed" as const, confirmed_value: null };
    const result = buildPacket({
      ...packetInput(),
      confirmedFields: [field, unconfirmed],
      selectedDocumentIds: ["DOC-1", "DOC-1"],
    });
    expect(result.confirmed_fields).toEqual([field]);
    expect(result.manifest.included_document_ids).toEqual(["DOC-1"]);
  });

  it("uses the manifest's exact section order for preview and PDF", () => {
    const result = packet();
    expect(result.manifest.sections).toEqual(PACKET_SECTIONS);
    expect(buildPacketSections(result).map((section) => section.name)).toEqual(
      result.manifest.sections,
    );
  });

  it("includes evidence, formulas, citations, checklist, unresolved items, and manifest values (raw default)", () => {
    const sections = buildPacketSections(packet());
    const text = sections.flatMap((section) => section.lines).join("\n");
    expect(text).toContain("from DOC-1, page 1");
    expect(text).toContain(calculation.formula);
    expect(text).toContain(citation.official_source);
    expect(text).toContain(citation.effective_date);
    expect(text).toContain("pay_stubs_recent — needs_confirmation");
    expect(text).toContain("pay_frequency needs confirmation");
    expect(text).toContain("Included documents: DOC-1");
  });

  it("applies the presentation map to labels, values, document names, statuses, and dates", () => {
    const sections = buildPacketSections(packet(), {
      fieldLabel: (n) => (n === "gross_pay" ? "Gross pay" : n),
      formatValue: (_n, v) => `$${Number(v).toLocaleString("en-US")}.00`,
      documentName: (id) => (id === "DOC-1" ? "stub_clean.pdf" : id),
      requirementTitle: (id) => (id === "pay_stubs_recent" ? "Two recent pay stubs" : id),
      statusLabel: (s) => (s === "needs_confirmation" ? "Needs confirmation" : s),
      calculationLabel: (t) => (t === "annualized_income" ? "Annual income" : t),
      formatDate: (d) => (d === "2026-05-01" ? "May 1, 2026" : d),
    });
    const text = sections.flatMap((section) => section.lines).join("\n");
    expect(text).toContain("Gross pay: $1,580.00 — from stub_clean.pdf, page 1");
    expect(text).toContain("Annual income: 1580.00 USD/biweekly");
    expect(text).toContain("Two recent pay stubs — Needs confirmation:");
    expect(text).toContain("effective May 1, 2026");
    expect(text).toContain("Included documents: stub_clean.pdf");
    // raw ids/statuses must NOT leak when a presentation is provided
    expect(text).not.toContain("pay_stubs_recent");
    expect(text).not.toContain("needs_confirmation");
  });
});

describe("packet PDF", () => {
  it("renders all canonical sections and appends selected PDF pages", async () => {
    const source = await PDFDocument.create();
    source.addPage([200, 200]);
    source.addPage([200, 200]);
    const attachmentBytes = await source.save();

    const bytes = await renderPacketPdf(packet(), [
      {
        documentId: "DOC-1",
        fileName: "pay-stub.pdf",
        bytes: attachmentBytes,
        mimeType: "application/pdf",
      },
    ]);
    const rendered = await PDFDocument.load(bytes);
    expect(rendered.getPageCount()).toBe(PACKET_SECTIONS.length + 2);
    expect(rendered.getTitle()).toBe("RealDoor application review packet");
  });

  it("renders a packet with no selected attachments", async () => {
    const bytes = await renderPacketPdf(packet([]), []);
    const rendered = await PDFDocument.load(bytes);
    expect(rendered.getPageCount()).toBe(PACKET_SECTIONS.length);
  });

  it("rejects attachments that were not renter-selected", async () => {
    await expect(
      renderPacketPdf(packet([]), [
        {
          documentId: "DOC-1",
          fileName: "unselected.pdf",
          bytes: new Uint8Array(),
          mimeType: "application/pdf",
        },
      ]),
    ).rejects.toThrow("exactly match");
  });

  it("rejects a selected attachment when its bytes were not supplied", async () => {
    await expect(renderPacketPdf(packet(), [])).rejects.toThrow("exactly match");
  });
});

function packetInput() {
  return {
    createdAt,
    profileVersion: 4,
    ruleVersion: citation.rule_version,
    checklistVersion: checklistItem.requirement_version,
    confirmedFields: [field],
    calculations: [calculation],
    citations: [citation],
    checklist: [checklistItem],
    selectedDocumentIds: ["DOC-1"],
    unresolvedItems: ["pay_frequency needs confirmation"],
  };
}
