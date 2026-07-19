import { pageUrl } from "./client";
import type { ExtractedFieldDto, ExtractionResultDto } from "./schemas";
import { fieldLabel } from "@/domain/field-meta";
import type { DocumentKind, ExtractedField, FieldName, SyntheticDocument } from "@/domain/types";

const KIND_BY_TYPE: Record<string, DocumentKind> = {
  pay_stub: "paystub",
  benefit_letter: "benefit_letter",
  photo_id: "id",
  lease: "lease",
};

function documentKind(fields: ExtractedFieldDto[]): DocumentKind {
  const type = fields.find((field) => field.field_name === "document_type")?.normalized_value;
  return KIND_BY_TYPE[String(type)] ?? "other";
}

function adaptField(field: ExtractedFieldDto): ExtractedField {
  const name = field.field_name as FieldName;
  return {
    id: field.id,
    docId: field.document_id,
    name,
    label: fieldLabel(name),
    proposedValue: field.normalized_value ?? field.model_proposed_value ?? field.raw_text ?? null,
    rawText: field.raw_text,
    modelProposedValue: field.model_proposed_value,
    normalizedValue: field.normalized_value,
    unit: field.unit ?? undefined,
    confidence: field.confidence,
    confidenceTier: field.confidence_tier,
    state: field.state,
    abstentionReason: field.abstention_reason,
    extractionVersion: field.extraction_version,
    source:
      field.page && field.bbox
        ? {
            page: field.page - 1,
            space: "pdf_points",
            bbox: {
              x: field.bbox.x,
              y: field.bbox.y,
              w: field.bbox.width,
              h: field.bbox.height,
            },
            label: fieldLabel(name),
          }
        : null,
  };
}

export function adaptExtraction(
  sessionId: string,
  displayName: string,
  extraction: ExtractionResultDto,
): SyntheticDocument {
  const pageCount = Math.max(1, ...extraction.fields.map((field) => field.page ?? 1));
  return {
    id: extraction.document_id,
    kind: documentKind(extraction.fields),
    displayName,
    synthetic: false,
    backendSessionId: sessionId,
    pageImages: Array.from({ length: pageCount }, (_, index) =>
      pageUrl(sessionId, extraction.document_id, index + 1),
    ),
    rawText: "",
    proposedFields: extraction.fields.map(adaptField),
  };
}
