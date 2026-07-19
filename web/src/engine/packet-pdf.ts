import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { Packet } from "../contracts";
import { buildPacketSections, type PacketPresentation, type PacketSection } from "./packet";

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 54;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const BODY_SIZE = 10;
const LINE_HEIGHT = 15;

const INK = rgb(0.1, 0.11, 0.14); // #1A1D23-ish
const BODY = rgb(0.25, 0.27, 0.31); // #3F4450-ish
const SUBTLE = rgb(0.42, 0.44, 0.5); // #6B7180-ish
const RULE = rgb(0.91, 0.9, 0.88); // #E7E5E1
const PRIMARY = rgb(0.11, 0.31, 0.85); // #1D4ED8

export interface PacketAttachment {
  documentId: string;
  fileName: string;
  bytes: Uint8Array;
  mimeType: "application/pdf" | "image/png" | "image/jpeg";
}

function pdfSafe(value: string): string {
  return value
    .replaceAll("×", "x")
    .replaceAll("−", "-")
    .replaceAll("—", "-")
    .replaceAll("–", "-")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'");
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = pdfSafe(text).split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      line = candidate;
    } else {
      if (line) lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines.length > 0 ? lines : [""];
}

function drawSectionHeader(page: PDFPage, title: string, bold: PDFFont): number {
  const top = PAGE_HEIGHT - MARGIN;
  page.drawText(pdfSafe(title), { x: MARGIN, y: top, size: 15, font: bold, color: INK });
  page.drawLine({
    start: { x: MARGIN, y: top - 10 },
    end: { x: PAGE_WIDTH - MARGIN, y: top - 10 },
    thickness: 1,
    color: RULE,
  });
  return top - 30;
}

/**
 * A "Label: value" line renders as a bold label + regular value with a hanging
 * indent; anything else is a plain wrapped paragraph. This is what gives the
 * confirmed-values and manifest lists their print-quality look.
 */
function drawEntry(
  doc: PDFDocument,
  page: PDFPage,
  title: string,
  y: number,
  raw: string,
  regular: PDFFont,
  bold: PDFFont,
): { page: PDFPage; y: number } {
  const ensure = (cur: PDFPage, curY: number): { page: PDFPage; y: number } => {
    if (curY >= MARGIN + LINE_HEIGHT) return { page: cur, y: curY };
    const next = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    return { page: next, y: drawSectionHeader(next, `${title} (continued)`, bold) };
  };

  const match = /^([^:]{1,42}): ([\s\S]+)$/.exec(raw);
  if (match) {
    const label = `${match[1]}:`;
    const labelWidth = bold.widthOfTextAtSize(pdfSafe(label), BODY_SIZE) + 5;
    const valueLines = wrap(match[2], regular, BODY_SIZE, CONTENT_WIDTH - labelWidth);
    valueLines.forEach((vl, i) => {
      ({ page, y } = ensure(page, y));
      if (i === 0) {
        page.drawText(pdfSafe(label), { x: MARGIN, y, size: BODY_SIZE, font: bold, color: INK });
      }
      page.drawText(vl, { x: MARGIN + labelWidth, y, size: BODY_SIZE, font: regular, color: BODY });
      y -= LINE_HEIGHT;
    });
  } else {
    for (const line of wrap(raw, regular, BODY_SIZE, CONTENT_WIDTH)) {
      ({ page, y } = ensure(page, y));
      page.drawText(line, { x: MARGIN, y, size: BODY_SIZE, font: regular, color: BODY });
      y -= LINE_HEIGHT;
    }
  }
  return { page, y: y - 6 };
}

function drawSection(
  doc: PDFDocument,
  section: PacketSection,
  regular: PDFFont,
  bold: PDFFont,
): void {
  let page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = drawSectionHeader(page, section.name, bold);
  for (const line of section.lines) {
    ({ page, y } = drawEntry(doc, page, section.name, y, line, regular, bold));
  }
}

/** A real cover page: eyebrow, big title, prepared date, disclaimer. */
function drawCover(doc: PDFDocument, section: PacketSection, regular: PDFFont, bold: PDFFont): void {
  const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const [title, prepared, disclaimer] = section.lines;
  let y = PAGE_HEIGHT - 150;

  page.drawText("APPLICATION READINESS PACKET", { x: MARGIN, y, size: 10, font: bold, color: PRIMARY });
  y -= 40;
  for (const line of wrap(title ?? "", bold, 26, CONTENT_WIDTH)) {
    page.drawText(line, { x: MARGIN, y, size: 26, font: bold, color: INK });
    y -= 32;
  }
  y -= 6;
  page.drawText(pdfSafe(prepared ?? ""), { x: MARGIN, y, size: 11, font: regular, color: SUBTLE });
  y -= 40;
  page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_WIDTH - MARGIN, y }, thickness: 1, color: RULE });
  y -= 28;
  for (const line of wrap(disclaimer ?? "", regular, 11, CONTENT_WIDTH)) {
    page.drawText(line, { x: MARGIN, y, size: 11, font: regular, color: BODY });
    y -= 17;
  }
}

async function appendAttachment(output: PDFDocument, attachment: PacketAttachment): Promise<void> {
  if (attachment.mimeType === "application/pdf") {
    const source = await PDFDocument.load(attachment.bytes);
    const pages = await output.copyPages(source, source.getPageIndices());
    pages.forEach((page) => output.addPage(page));
    return;
  }

  const image =
    attachment.mimeType === "image/png"
      ? await output.embedPng(attachment.bytes)
      : await output.embedJpg(attachment.bytes);
  const page = output.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const scale = Math.min(
    (PAGE_WIDTH - MARGIN * 2) / image.width,
    (PAGE_HEIGHT - MARGIN * 2) / image.height,
    1,
  );
  page.drawImage(image, {
    x: (PAGE_WIDTH - image.width * scale) / 2,
    y: (PAGE_HEIGHT - image.height * scale) / 2,
    width: image.width * scale,
    height: image.height * scale,
  });
}

/** Render the canonical sections, then append only renter-selected documents. */
export async function renderPacketPdf(
  packet: Packet,
  attachments: PacketAttachment[],
  presentation?: Partial<PacketPresentation>,
): Promise<Uint8Array> {
  const selectedIds = packet.manifest.included_document_ids;
  const suppliedIds = attachments.map((attachment) => attachment.documentId);
  if (
    selectedIds.some((id) => !suppliedIds.includes(id)) ||
    suppliedIds.some((id) => !selectedIds.includes(id)) ||
    new Set(suppliedIds).size !== suppliedIds.length
  ) {
    throw new Error("Attachments must exactly match the renter-selected packet manifest.");
  }

  const output = await PDFDocument.create();
  output.setTitle(packet.cover.title);
  output.setSubject(packet.cover.disclaimer);
  output.setCreationDate(new Date(packet.manifest.created_at));
  const regular = await output.embedFont(StandardFonts.Helvetica);
  const bold = await output.embedFont(StandardFonts.HelveticaBold);

  for (const section of buildPacketSections(packet, presentation)) {
    if (section.name === "Cover") drawCover(output, section, regular, bold);
    else drawSection(output, section, regular, bold);
  }

  for (const attachment of attachments) await appendAttachment(output, attachment);
  return output.save();
}
