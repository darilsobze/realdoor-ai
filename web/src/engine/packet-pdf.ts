import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { Packet } from "../contracts";
import { buildPacketSections } from "./packet";

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 54;
const BODY_SIZE = 10;
const LINE_HEIGHT = 15;

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

function wrapLine(text: string, font: PDFFont, maxWidth: number): string[] {
  const words = pdfSafe(text).split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, BODY_SIZE) <= maxWidth) {
      line = candidate;
    } else {
      if (line) lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines.length > 0 ? lines : [""];
}

function drawHeader(page: PDFPage, title: string, font: PDFFont): number {
  page.drawText(pdfSafe(title), {
    x: MARGIN,
    y: PAGE_HEIGHT - MARGIN,
    size: 18,
    font,
    color: rgb(0.08, 0.16, 0.25),
  });
  return PAGE_HEIGHT - MARGIN - 30;
}

function drawLines(
  document: PDFDocument,
  initialPage: PDFPage,
  title: string,
  lines: string[],
  regular: PDFFont,
  bold: PDFFont,
): void {
  let page = initialPage;
  let y = drawHeader(page, title, bold);
  for (const rawLine of lines) {
    for (const line of wrapLine(rawLine, regular, PAGE_WIDTH - MARGIN * 2)) {
      if (y < MARGIN) {
        page = document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
        y = drawHeader(page, `${title} (continued)`, bold);
      }
      page.drawText(line, {
        x: MARGIN,
        y,
        size: BODY_SIZE,
        font: regular,
        color: rgb(0.13, 0.18, 0.23),
      });
      y -= LINE_HEIGHT;
    }
    y -= 5;
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

  for (const section of buildPacketSections(packet)) {
    const page = output.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    drawLines(output, page, section.name, section.lines, regular, bold);
  }

  for (const attachment of attachments) await appendAttachment(output, attachment);
  return output.save();
}
