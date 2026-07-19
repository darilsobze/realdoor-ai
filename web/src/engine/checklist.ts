import type { DocumentType } from "../contracts/allowlist";
import {
  ChecklistResultSchema,
  type ChecklistRequirement,
  type ChecklistResult,
  type GoldChecklistFile,
} from "../contracts/checklist";

const DAY_IN_MS = 24 * 60 * 60 * 1_000;

export interface ChecklistDocumentMetadata {
  documentId: string;
  documentType: DocumentType;
  documentTypeConfirmed: boolean;
  documentDate: string | null;
  documentDateConfirmed: boolean;
  conflicting: boolean;
}

export interface ChecklistAttestations {
  householdSizeConfirmed: boolean;
}

export interface EvaluateChecklistInput {
  checklist: GoldChecklistFile;
  documents: ChecklistDocumentMetadata[];
  attestations: ChecklistAttestations;
  /** ISO date supplied by the caller; no clock access keeps this engine pure. */
  asOfDate: string;
}

function isoDay(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const milliseconds = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isNaN(milliseconds) ? null : milliseconds;
}

function isConditionalRequirementApplicable(
  requirement: ChecklistRequirement,
  documents: ChecklistDocumentMetadata[],
): boolean {
  switch (requirement.requirement_id) {
    case "employment_letter":
      return documents.some((document) => document.documentType === "pay_stub");
    case "benefit_letter_current":
      return documents.some((document) => document.documentType === "benefit_letter");
    case "gig_income_corroboration":
      return documents.some((document) => document.documentType === "gig_statement");
    default:
      return true;
  }
}

function evaluateAttestation(
  requirement: ChecklistRequirement,
  checklistVersion: string,
  attestations: ChecklistAttestations,
): ChecklistResult {
  const confirmed =
    requirement.requirement_id === "household_size_confirmation" &&
    attestations.householdSizeConfirmed;

  return {
    requirement_id: requirement.requirement_id,
    requirement_version: checklistVersion,
    status: confirmed ? "confirmed" : "needs_confirmation",
    explanation: confirmed
      ? "The renter confirmed the household size."
      : "The renter needs to confirm the household size.",
    matched_document_ids: [],
  };
}

function evaluateDocumentRequirement(
  requirement: ChecklistRequirement,
  checklistVersion: string,
  documents: ChecklistDocumentMetadata[],
  asOfDate: string,
): ChecklistResult {
  if (!isConditionalRequirementApplicable(requirement, documents)) {
    return {
      requirement_id: requirement.requirement_id,
      requirement_version: checklistVersion,
      status: "not_applicable",
      explanation: "This requirement does not apply to the confirmed document set.",
      matched_document_ids: [],
    };
  }

  const matches = documents.filter((document) =>
    requirement.accepted_document_types.includes(document.documentType),
  );
  const matchedIds = matches.map((document) => document.documentId);

  if (matches.length === 0) {
    return {
      requirement_id: requirement.requirement_id,
      requirement_version: checklistVersion,
      status: "missing",
      explanation: `No matching document was provided; ${requirement.min_count} required.`,
      matched_document_ids: [],
    };
  }

  const unconfirmedTypes = matches.filter((document) => !document.documentTypeConfirmed);
  if (unconfirmedTypes.length > 0) {
    return {
      requirement_id: requirement.requirement_id,
      requirement_version: checklistVersion,
      status: "needs_confirmation",
      explanation: "A matching document type needs confirmation before it can count.",
      matched_document_ids: matchedIds,
    };
  }

  if (matches.some((document) => document.conflicting)) {
    return {
      requirement_id: requirement.requirement_id,
      requirement_version: checklistVersion,
      status: "conflicting",
      explanation: "Matching documents contain conflicting confirmed information and need review.",
      matched_document_ids: matchedIds,
    };
  }

  if (requirement.freshness_days !== null) {
    const asOf = isoDay(asOfDate);
    if (asOf === null) throw new Error(`Invalid checklist as-of date: ${asOfDate}`);

    const unconfirmedDates = matches.filter(
      (document) => !document.documentDateConfirmed || document.documentDate === null,
    );
    const currentDocuments = matches.filter((document) => {
      if (!document.documentDateConfirmed || document.documentDate === null) return false;
      const documentDay = isoDay(document.documentDate);
      return (
        documentDay !== null &&
        documentDay <= asOf &&
        (asOf - documentDay) / DAY_IN_MS <= requirement.freshness_days!
      );
    });

    if (currentDocuments.length >= requirement.min_count) {
      return {
        requirement_id: requirement.requirement_id,
        requirement_version: checklistVersion,
        status: "confirmed",
        explanation: `${currentDocuments.length} current matching document(s) meet the requirement.`,
        matched_document_ids: currentDocuments.map((document) => document.documentId),
      };
    }

    if (unconfirmedDates.length > 0) {
      return {
        requirement_id: requirement.requirement_id,
        requirement_version: checklistVersion,
        status: "needs_confirmation",
        explanation: "A matching document date needs confirmation before freshness can be checked.",
        matched_document_ids: matchedIds,
      };
    }

    const expiredCount = matches.length - currentDocuments.length;
    if (expiredCount > 0) {
      return {
        requirement_id: requirement.requirement_id,
        requirement_version: checklistVersion,
        status: "expired",
        explanation: `${expiredCount} matching document(s) fall outside the ${requirement.freshness_days}-day window.`,
        matched_document_ids: matchedIds,
      };
    }
  }

  if (matches.length < requirement.min_count) {
    return {
      requirement_id: requirement.requirement_id,
      requirement_version: checklistVersion,
      status: "missing",
      explanation: `${matches.length} matching document(s) provided; ${requirement.min_count} required.`,
      matched_document_ids: matchedIds,
    };
  }

  return {
    requirement_id: requirement.requirement_id,
    requirement_version: checklistVersion,
    status: "confirmed",
    explanation: `${matches.length} confirmed matching document(s) meet the requirement.`,
    matched_document_ids: matchedIds,
  };
}

export function evaluateChecklist(input: EvaluateChecklistInput): ChecklistResult[] {
  const results = input.checklist.requirements.map((requirement) =>
    requirement.kind === "attestation"
      ? evaluateAttestation(requirement, input.checklist.checklist_version, input.attestations)
      : evaluateDocumentRequirement(
          requirement,
          input.checklist.checklist_version,
          input.documents,
          input.asOfDate,
        ),
  );

  return ChecklistResultSchema.array().parse(results);
}
