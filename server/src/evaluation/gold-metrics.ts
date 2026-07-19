import { z } from "zod";
import {
  FIELD_ALLOWLIST,
  FieldNameSchema,
  type BBox,
  type ExtractionResult,
  type FieldName,
} from "../../../web/src/contracts/index.ts";

const GoldBoxSchema = z.tuple([z.number(), z.number(), z.number(), z.number()]);
export type GoldBox = z.infer<typeof GoldBoxSchema>;

export const GoldFieldSchema = z.object({
  field: z.string().min(1),
  value: z.union([z.string(), z.number()]),
  page: z.number().int().positive(),
  bbox: GoldBoxSchema,
  bbox_units: z.literal("pdf_points_bottom_left_origin"),
});
export type GoldField = z.infer<typeof GoldFieldSchema>;

export const GoldDocumentSchema = z.object({
  document_id: z.string().min(1),
  document_type: z.string().min(1),
  file_name: z.string().min(1),
  page_count: z.number().int().positive(),
  page_size_points: z.tuple([z.number().positive(), z.number().positive()]),
  fields: z.array(GoldFieldSchema),
});
export type GoldDocument = z.infer<typeof GoldDocumentSchema>;

export interface GoldTarget {
  documentId: string;
  fieldName: FieldName;
  goldField: string;
  expectedValue: string | number;
  page: number | null;
  goldBox: BBox | null;
}

export interface GoldTargetResult extends GoldTarget {
  predictedValue: string | number | null;
  abstained: boolean;
  valueCorrect: boolean;
  iou: number | null;
}

export interface GoldMetricsReport {
  documents: number;
  documentType: {
    targets: number;
    correct: number;
    accuracy: number;
  };
  valueFields: {
    goldTargets: number;
    correct: number;
    unexpectedPredictions: number;
    accuracyDenominator: number;
    accuracy: number;
    goldTargetRecall: number;
    abstained: number;
    abstentionRate: number;
  };
  box: {
    targets: number;
    meanIou: number;
    iouAt50: number;
    iouAt50Rate: number;
  };
  unscorableAllowlistedFields: FieldName[];
  unexpectedDetails: Array<{
    documentId: string;
    fieldName: FieldName;
    predictedValue: string | number;
  }>;
  details: GoldTargetResult[];
}

const GOLD_FIELD_ALIASES: Readonly<Record<string, FieldName>> = {
  application_date: "document_date",
  pay_date: "document_date",
  monthly_benefit: "benefit_amount",
};

export function parseGoldJsonl(raw: string): GoldDocument[] {
  const documents = raw
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line, index) => {
      try {
        return GoldDocumentSchema.parse(JSON.parse(line));
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        throw new Error(`Invalid gold line ${index + 1}: ${reason}`);
      }
    });
  if (documents.length !== 24) {
    throw new Error(`Expected 24 organizer gold documents; received ${documents.length}.`);
  }
  const ids = new Set<string>();
  const files = new Set<string>();
  for (const document of documents) {
    if (ids.has(document.document_id)) {
      throw new Error(`Duplicate document_id in organizer gold set: ${document.document_id}.`);
    }
    if (files.has(document.file_name)) {
      throw new Error(`Duplicate file_name in organizer gold set: ${document.file_name}.`);
    }
    ids.add(document.document_id);
    files.add(document.file_name);

    const targetFields = new Set<FieldName>();
    for (const target of buildGoldTargets(document)) {
      if (targetFields.has(target.fieldName)) {
        throw new Error(
          `Duplicate aliased target ${target.fieldName} for ${document.document_id}.`,
        );
      }
      targetFields.add(target.fieldName);
    }
  }
  return documents;
}

export function goldBoxToTopLeft(
  [x1, y1, x2, y2]: GoldBox,
  pageHeight: number,
): BBox {
  return {
    x: x1,
    y: pageHeight - y2,
    width: x2 - x1,
    height: y2 - y1,
  };
}

export function intersectionOverUnion(a: BBox, b: BBox): number {
  const intersectionWidth = Math.max(
    0,
    Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x),
  );
  const intersectionHeight = Math.max(
    0,
    Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y),
  );
  const intersection = intersectionWidth * intersectionHeight;
  const union = a.width * a.height + b.width * b.height - intersection;
  return union > 0 ? intersection / union : 0;
}

export function buildGoldTargets(document: GoldDocument): GoldTarget[] {
  const targets: GoldTarget[] = [
    {
      documentId: document.document_id,
      fieldName: "document_type",
      goldField: "document_type",
      expectedValue: document.document_type,
      page: null,
      goldBox: null,
    },
  ];

  for (const goldField of document.fields) {
    const direct = FieldNameSchema.safeParse(goldField.field);
    const fieldName = GOLD_FIELD_ALIASES[goldField.field] ?? (direct.success ? direct.data : null);
    if (!fieldName || fieldName === "document_type") continue;
    targets.push({
      documentId: document.document_id,
      fieldName,
      goldField: goldField.field,
      expectedValue: goldField.value,
      page: goldField.page,
      goldBox: goldBoxToTopLeft(goldField.bbox, document.page_size_points[1]),
    });
  }

  return targets;
}

function valuesEqual(actual: string | number | null, expected: string | number): boolean {
  if (actual === null) return false;
  if (typeof expected === "number") {
    return typeof actual === "number" && Number.isFinite(actual) && actual === expected;
  }
  return String(actual).trim().toLowerCase() === expected.trim().toLowerCase();
}

function ratio(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator;
}

export function scoreGoldSet(
  documents: GoldDocument[],
  extractions: ExtractionResult[],
): GoldMetricsReport {
  const extractionByDocument = new Map(extractions.map((result) => [result.document_id, result]));
  const targets = documents.flatMap(buildGoldTargets);
  const details: GoldTargetResult[] = targets.map((target) => {
    const prediction = extractionByDocument
      .get(target.documentId)
      ?.fields.find((field) => field.field_name === target.fieldName);
    const abstained =
      !prediction || prediction.state === "unresolved" || prediction.normalized_value === null;
    const predictedValue = prediction?.normalized_value ?? null;
    const valueCorrect = !abstained && valuesEqual(predictedValue, target.expectedValue);
    let iou: number | null = null;
    if (target.goldBox) {
      iou =
        valueCorrect && prediction?.page === target.page && prediction.bbox
          ? intersectionOverUnion(prediction.bbox, target.goldBox)
          : 0;
    }
    return { ...target, predictedValue, abstained, valueCorrect, iou };
  });

  const documentTypeDetails = details.filter((detail) => detail.fieldName === "document_type");
  const valueDetails = details.filter((detail) => detail.fieldName !== "document_type");
  const documentTypeCorrect = documentTypeDetails.filter((detail) => detail.valueCorrect).length;
  const valueCorrect = valueDetails.filter((detail) => detail.valueCorrect).length;
  const valueAbstained = valueDetails.filter((detail) => detail.abstained).length;
  const boxDetails = valueDetails.filter((detail) => detail.goldBox !== null);
  const iouSum = boxDetails.reduce((sum, detail) => sum + (detail.iou ?? 0), 0);
  const iouAt50 = boxDetails.filter((detail) => (detail.iou ?? 0) >= 0.5).length;
  const targetedFields = new Set(targets.map((target) => target.fieldName));
  const unscorableAllowlistedFields = FIELD_ALLOWLIST.filter((field) => !targetedFields.has(field));
  const unscorable = new Set<FieldName>(unscorableAllowlistedFields);
  const targetsByDocument = new Map<string, Set<FieldName>>();
  for (const target of targets) {
    const documentTargets = targetsByDocument.get(target.documentId) ?? new Set<FieldName>();
    documentTargets.add(target.fieldName);
    targetsByDocument.set(target.documentId, documentTargets);
  }
  const unexpectedDetails = extractions.flatMap((extraction) =>
    extraction.fields
      .filter(
        (field) =>
          field.field_name !== "document_type" &&
          field.state !== "unresolved" &&
          field.normalized_value !== null &&
          !unscorable.has(field.field_name) &&
          !targetsByDocument.get(extraction.document_id)?.has(field.field_name),
      )
      .map((field) => ({
        documentId: extraction.document_id,
        fieldName: field.field_name,
        predictedValue: field.normalized_value as string | number,
      })),
  );
  const accuracyDenominator = valueDetails.length + unexpectedDetails.length;

  return {
    documents: documents.length,
    documentType: {
      targets: documentTypeDetails.length,
      correct: documentTypeCorrect,
      accuracy: ratio(documentTypeCorrect, documentTypeDetails.length),
    },
    valueFields: {
      goldTargets: valueDetails.length,
      correct: valueCorrect,
      unexpectedPredictions: unexpectedDetails.length,
      accuracyDenominator,
      accuracy: ratio(valueCorrect, accuracyDenominator),
      goldTargetRecall: ratio(valueCorrect, valueDetails.length),
      abstained: valueAbstained,
      abstentionRate: ratio(valueAbstained, valueDetails.length),
    },
    box: {
      targets: boxDetails.length,
      meanIou: ratio(iouSum, boxDetails.length),
      iouAt50,
      iouAt50Rate: ratio(iouAt50, boxDetails.length),
    },
    unscorableAllowlistedFields,
    unexpectedDetails,
    details,
  };
}

function percentage(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

export interface GoldMetricsProvenance {
  providerName: string;
  extractionVersion: string;
  evaluationSchemaVersion: string;
}

export function formatGoldMetricsMarkdown(
  report: GoldMetricsReport,
  provenance: GoldMetricsProvenance,
): string {
  return [
    "# RealDoor gold extraction metrics",
    "",
    `Documents: ${report.documents}`,
    `Provider: ${provenance.providerName}`,
    `Extraction version: ${provenance.extractionVersion}`,
    `Evaluation schema: ${provenance.evaluationSchemaVersion}`,
    `Document-type accuracy: ${report.documentType.correct}/${report.documentType.targets} (${percentage(report.documentType.accuracy)})`,
    `Value-field accuracy: ${report.valueFields.correct}/${report.valueFields.accuracyDenominator} (${percentage(report.valueFields.accuracy)})`,
    `Gold-target recall: ${report.valueFields.correct}/${report.valueFields.goldTargets} (${percentage(report.valueFields.goldTargetRecall)})`,
    `Mean IoU: ${percentage(report.box.meanIou)}`,
    `IoU ≥ 0.5: ${report.box.iouAt50}/${report.box.targets} (${percentage(report.box.iouAt50Rate)})`,
    `Value-field abstention rate: ${report.valueFields.abstained}/${report.valueFields.goldTargets} (${percentage(report.valueFields.abstentionRate)})`,
    `Unexpected predictions: ${report.valueFields.unexpectedPredictions}`,
    `Unscorable allowlisted fields: ${report.unscorableAllowlistedFields.join(", ") || "none"}`,
    "",
  ].join("\n");
}
