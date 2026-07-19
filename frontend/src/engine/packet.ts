import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export type PacketInput = {
  generatedAt: string;
  profileVersion: number;
  ruleVersion: string;
  checklistVersion: string;
  householdSize: number | null;
  confirmedFields: Array<{
    name: string;
    value: string | number;
    status: string;
    documentName: string;
  }>;
  checklist: Array<{ title: string; status: string; explanation: string }>;
  selectedDocumentNames: string[];
  notes: string;
};

export function buildPacketLines(input: PacketInput): string[] {
  const lines = [
    "RealDoor application-readiness packet",
    "This preparation draft does not decide eligibility. A qualified human reviewer decides.",
    "",
    `Generated: ${input.generatedAt}`,
    `Profile version: ${input.profileVersion}`,
    `Rule version: ${input.ruleVersion}`,
    `Checklist version: ${input.checklistVersion}`,
    `Household size (renter-confirmed): ${input.householdSize ?? "not confirmed"}`,
    "",
    "Renter-confirmed values",
  ];
  if (input.confirmedFields.length === 0) lines.push("- No values confirmed.");
  for (const field of input.confirmedFields) {
    lines.push(
      `- ${field.name}: ${field.value} [${field.status}; source document: ${field.documentName}]`,
    );
  }
  lines.push("", "Gold checklist");
  for (const item of input.checklist) {
    lines.push(`- ${item.title} — ${item.status.toUpperCase()}: ${item.explanation}`);
  }
  lines.push("", "Attachments selected by the renter");
  if (input.selectedDocumentNames.length === 0) lines.push("- None selected.");
  for (const name of input.selectedDocumentNames) lines.push(`- ${name}`);
  if (input.notes.trim()) lines.push("", "Renter notes", input.notes.trim());
  lines.push(
    "",
    "Nothing was submitted or sent to a property. The renter controls this downloaded draft.",
  );
  return lines;
}

function pdfSafe(value: string): string {
  return value
    .replaceAll("—", "-")
    .replaceAll("→", "->")
    .replaceAll("×", "x")
    .replace(/[^\x20-\x7E]/g, "?");
}

function wrap(value: string, max = 88): string[] {
  if (!value) return [""];
  const words = pdfSafe(value).split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > max && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  lines.push(current);
  return lines;
}

export async function renderPacketPdf(input: PacketInput): Promise<Uint8Array> {
  const document = await PDFDocument.create();
  document.setTitle("RealDoor application-readiness packet");
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  let page = document.addPage([612, 792]);
  let y = 744;

  for (const [lineIndex, logicalLine] of buildPacketLines(input).entries()) {
    for (const line of wrap(logicalLine)) {
      if (y < 48) {
        page = document.addPage([612, 792]);
        y = 744;
      }
      const heading =
        lineIndex === 0 ||
        [
          "Renter-confirmed values",
          "Gold checklist",
          "Attachments selected by the renter",
          "Renter notes",
        ].includes(logicalLine);
      page.drawText(line, {
        x: 48,
        y,
        size: lineIndex === 0 ? 18 : 10,
        font: heading ? bold : regular,
        color: rgb(0.08, 0.12, 0.2),
      });
      y -= lineIndex === 0 ? 28 : 15;
    }
  }
  return document.save();
}
