// Full extraction pipeline: render+OCR -> schema-constrained Claude extraction
// -> value->token bbox matching -> deterministic normalization -> ExtractedField[]
// (validated against the shared contracts before anything leaves the server).
import { randomUUID } from "node:crypto";
import {
  ExtractedFieldSchema,
  ExtractionResultSchema,
  type DocumentType,
  type ExtractedField,
  type ExtractionResult,
  type FieldName,
} from "../../../web/src/contracts/index.ts";
import { ocrPdf, type OcrPage } from "../ocr.ts";
import { EXTRACTION_VERSION, extractFields, type LlmExtraction } from "./claude.ts";
import { matchValueToTokens } from "./match.ts";
import { normalizeField } from "./normalize.ts";

/** Fields a renter would expect on each document type; missing ones become
 *  explicit unable_to_extract rows instead of silently disappearing. */
const EXPECTED_FIELDS: Partial<Record<DocumentType, FieldName[]>> = {
  pay_stub: ["gross_pay", "pay_period_start", "pay_period_end", "pay_frequency", "employer_name"],
  benefit_letter: ["benefit_amount", "benefit_frequency", "document_date"],
  employment_letter: ["employer_name", "document_date"],
};

function abstained(
  documentId: string,
  field: FieldName,
  reason: string,
): ExtractedField {
  return {
    id: randomUUID(),
    document_id: documentId,
    field_name: field,
    raw_text: null,
    model_proposed_value: null,
    normalized_value: null,
    unit: null,
    page: null,
    bbox: null,
    confidence: null,
    confidence_tier: "none",
    state: "unresolved",
    abstention_reason: reason,
    extraction_version: EXTRACTION_VERSION,
  };
}

function buildFields(
  documentId: string,
  llm: LlmExtraction,
  pages: OcrPage[],
): ExtractedField[] {
  const out: ExtractedField[] = [];
  const seen = new Set<FieldName>();

  for (const f of llm.fields) {
    if (seen.has(f.field_name)) continue; // first occurrence wins; duplicates need renter review anyway
    seen.add(f.field_name);

    const pageWords = pages.find((p) => p.page === f.page)?.words ?? [];
    const match = matchValueToTokens(f.raw_text, pageWords);

    // document_type raw_text is heading evidence; the value itself is the enum.
    const { value, unit } = normalizeField(f.field_name, f.raw_text);

    if (match.tier === "none") {
      out.push(
        abstained(
          documentId,
          f.field_name,
          "The value could not be located in the document text, so it cannot be shown with evidence.",
        ),
      );
      continue;
    }
    if (value === null) {
      out.push(
        abstained(
          documentId,
          f.field_name,
          "The text was found but could not be read as a valid value.",
        ),
      );
      continue;
    }

    out.push({
      id: randomUUID(),
      document_id: documentId,
      field_name: f.field_name,
      raw_text: f.raw_text,
      model_proposed_value: f.raw_text,
      normalized_value: value,
      unit,
      page: f.page,
      bbox: match.bbox,
      confidence: match.confidence,
      confidence_tier: match.tier,
      state: "proposed",
      abstention_reason: null,
      extraction_version: EXTRACTION_VERSION,
    });
  }

  // Expected-but-missing fields become explicit abstentions.
  const docType = out.find((f) => f.field_name === "document_type")?.normalized_value;
  const expected = typeof docType === "string" ? EXPECTED_FIELDS[docType as DocumentType] : undefined;
  for (const field of expected ?? []) {
    if (!seen.has(field)) {
      out.push(
        abstained(documentId, field, "This value could not be read from the document."),
      );
    }
  }

  return out;
}

export async function extractDocument(
  documentId: string,
  pdfData: Uint8Array,
): Promise<ExtractionResult> {
  const pages = await ocrPdf(pdfData);
  const llm = await extractFields(pages.map((p) => ({ page: p.page, text: p.text })));
  const fields = buildFields(documentId, llm, pages).map((f) => ExtractedFieldSchema.parse(f));
  return ExtractionResultSchema.parse({
    document_id: documentId,
    extraction_version: EXTRACTION_VERSION,
    fields,
  });
}
