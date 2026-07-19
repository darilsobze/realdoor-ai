import type { GoldChecklist, GoldRequirement } from "@/domain/gold-checklist";

const DAY = 24 * 60 * 60 * 1000;

export type ChecklistDocument = {
  documentId: string;
  documentType: string;
  documentTypeConfirmed: boolean;
  documentDate: string | null;
  documentDateConfirmed: boolean;
  conflicting: boolean;
};

export type GoldChecklistStatus =
  "confirmed" | "needs_confirmation" | "missing" | "expired" | "conflicting" | "not_applicable";

export type GoldChecklistResult = {
  requirement_id: string;
  requirement_version: string;
  status: GoldChecklistStatus;
  explanation: string;
  matched_document_ids: string[];
};

function applies(requirement: GoldRequirement, documents: ChecklistDocument[]): boolean {
  if (requirement.requirement_id === "employment_letter") {
    return documents.some((document) => document.documentType === "pay_stub");
  }
  if (requirement.requirement_id === "benefit_letter_current") {
    return documents.some((document) => document.documentType === "benefit_letter");
  }
  if (requirement.requirement_id === "gig_income_corroboration") {
    return documents.some((document) => document.documentType === "gig_statement");
  }
  return true;
}

function result(
  requirement: GoldRequirement,
  version: string,
  status: GoldChecklistStatus,
  explanation: string,
  ids: string[] = [],
): GoldChecklistResult {
  return {
    requirement_id: requirement.requirement_id,
    requirement_version: version,
    status,
    explanation,
    matched_document_ids: ids,
  };
}

export function evaluateGoldChecklist(params: {
  checklist: GoldChecklist;
  documents: ChecklistDocument[];
  householdSizeConfirmed: boolean;
  asOfDate: string;
}): GoldChecklistResult[] {
  const asOf = Date.parse(`${params.asOfDate}T00:00:00.000Z`);
  return params.checklist.requirements.map((requirement) => {
    if (requirement.kind === "attestation") {
      return result(
        requirement,
        params.checklist.checklist_version,
        params.householdSizeConfirmed ? "confirmed" : "needs_confirmation",
        params.householdSizeConfirmed
          ? "The renter confirmed household size."
          : "The renter needs to confirm household size.",
      );
    }
    if (!applies(requirement, params.documents)) {
      return result(
        requirement,
        params.checklist.checklist_version,
        "not_applicable",
        "This requirement does not apply to the confirmed document set.",
      );
    }
    const matches = params.documents.filter((document) =>
      requirement.accepted_document_types.includes(document.documentType),
    );
    const ids = matches.map((document) => document.documentId);
    if (matches.length === 0) {
      return result(
        requirement,
        params.checklist.checklist_version,
        "missing",
        `No matching document was provided; ${requirement.min_count} required.`,
      );
    }
    if (matches.some((document) => !document.documentTypeConfirmed)) {
      return result(
        requirement,
        params.checklist.checklist_version,
        "needs_confirmation",
        "A matching document type needs confirmation before it can count.",
        ids,
      );
    }
    if (matches.some((document) => document.conflicting)) {
      return result(
        requirement,
        params.checklist.checklist_version,
        "conflicting",
        "Matching documents contain conflicting confirmed information.",
        ids,
      );
    }
    if (requirement.freshness_days !== null) {
      if (matches.some((document) => !document.documentDateConfirmed || !document.documentDate)) {
        return result(
          requirement,
          params.checklist.checklist_version,
          "needs_confirmation",
          "A matching document date needs confirmation before freshness can be checked.",
          ids,
        );
      }
      const current = matches.filter((document) => {
        const date = Date.parse(`${document.documentDate}T00:00:00.000Z`);
        return date <= asOf && (asOf - date) / DAY <= requirement.freshness_days!;
      });
      if (current.length >= requirement.min_count) {
        return result(
          requirement,
          params.checklist.checklist_version,
          "confirmed",
          `${current.length} current matching document(s) meet the requirement.`,
          current.map((document) => document.documentId),
        );
      }
      if (matches.length > 0 && current.length === 0) {
        return result(
          requirement,
          params.checklist.checklist_version,
          "expired",
          `${matches.length} matching document(s) fall outside the ${requirement.freshness_days}-day window.`,
          ids,
        );
      }
    }
    if (matches.length < requirement.min_count) {
      return result(
        requirement,
        params.checklist.checklist_version,
        "missing",
        `${matches.length} matching document(s) provided; ${requirement.min_count} required.`,
        ids,
      );
    }
    return result(
      requirement,
      params.checklist.checklist_version,
      "confirmed",
      `${matches.length} confirmed matching document(s) meet the requirement.`,
      ids,
    );
  });
}
