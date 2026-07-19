// Full extraction pipeline: render+OCR -> schema-constrained Claude extraction
// -> value->token bbox matching -> deterministic normalization -> ExtractedField[]
// (validated against the shared contracts before anything leaves the server).
import { randomUUID } from "node:crypto";
import {
  ExtractedFieldSchema,
  ExtractionResultSchema,
  FIELD_ALLOWLIST,
  type ExtractedField,
  type ExtractionResult,
  type FieldName,
} from "../../../web/src/contracts/index.ts";
import { ocrPdf, type OcrPage } from "../ocr.ts";
import { extractFields } from "./extract.ts";
import { EXPECTED_FIELDS, EXTRACTION_VERSION, type LlmExtraction } from "./schema.ts";
import { matchValueToTokens } from "./match.ts";
import { normalizeField } from "./normalize.ts";

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
    const fieldName = f.field_name as FieldName;
    if (seen.has(fieldName)) continue; // first occurrence wins; duplicates need renter review anyway
    seen.add(fieldName);

    const pageWords = pages.find((p) => p.page === f.page)?.words ?? [];
    const match = matchValueToTokens(f.raw_text, pageWords);
    const { value, unit } = normalizeField(fieldName, f.raw_text);

    if (match.tier === "none") {
      // Local debugging only (synthetic fixtures). Never enabled in normal
      // runs — raw document text must not reach logs (CLAUDE.md).
      if (process.env.DEBUG_EXTRACTION === "1") {
        console.error(
          `[debug] no token match: field=${fieldName} raw_text=${JSON.stringify(f.raw_text)} page=${f.page}`,
        );
      }
      out.push(
        abstained(
          documentId,
          fieldName,
          "The value could not be located in the document text, so it cannot be shown with evidence.",
        ),
      );
      continue;
    }
    if (value === null) {
      out.push(
        abstained(
          documentId,
          fieldName,
          "The text was found but could not be read as a valid value.",
        ),
      );
      continue;
    }

    out.push({
      id: randomUUID(),
      document_id: documentId,
      field_name: fieldName,
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

  // document_type is a classification, not a verbatim extracted value. Keep
  // it proposed even when the optional heading evidence cannot be matched;
  // confidence stays "none" so the renter is clearly asked to review it.
  const evidence = llm.document_type_evidence.trim();
  const evidencePage = pages[0];
  const evidenceMatch = evidence
    ? matchValueToTokens(evidence, evidencePage?.words ?? [])
    : null;
  const hasMatchedEvidence = evidenceMatch && evidenceMatch.tier !== "none";
  out.push({
    id: randomUUID(),
    document_id: documentId,
    field_name: "document_type",
    raw_text: evidence || null,
    model_proposed_value: llm.document_type,
    normalized_value: llm.document_type,
    unit: null,
    page: hasMatchedEvidence ? evidencePage.page : null,
    bbox: hasMatchedEvidence ? evidenceMatch.bbox : null,
    confidence: hasMatchedEvidence ? evidenceMatch.confidence : null,
    confidence_tier: hasMatchedEvidence ? evidenceMatch.tier : "none",
    state: "proposed",
    abstention_reason: null,
    extraction_version: EXTRACTION_VERSION,
  });

  // Expected-but-missing fields become explicit abstentions (based on the
  // model's classification, whether or not its evidence matched).
  for (const field of (EXPECTED_FIELDS[llm.document_type] ?? []) as FieldName[]) {
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
  const llm = await extractFields(
    pages.map((p) => ({ page: p.page, text: p.text, png: p.png })),
  );
  const fields = buildFields(documentId, llm, pages).map((f) => ExtractedFieldSchema.parse(f));
  // Canonical allowlist order: run-to-run output must be comparable byte for byte.
  fields.sort(
    (a, b) => FIELD_ALLOWLIST.indexOf(a.field_name) - FIELD_ALLOWLIST.indexOf(b.field_name),
  );
  return ExtractionResultSchema.parse({
    document_id: documentId,
    extraction_version: EXTRACTION_VERSION,
    fields,
  });
}
