import type {
  ChecklistItemDef,
  ChecklistItemResult,
  ChecklistStatus,
  ConfirmedField,
  SyntheticDocument,
} from "./types";
import { documentExpiryStatus } from "./calc";

/**
 * Compute checklist item status from confirmed fields + present documents.
 * Never returns an eligibility verdict — only status of the reference checklist.
 */
export function evaluateChecklistItem(params: {
  def: ChecklistItemDef;
  confirmedFields: ConfirmedField[];
  documents: SyntheticDocument[];
  ruleAvailable: boolean;
  today?: Date;
}): ChecklistItemResult {
  const { def, confirmedFields, documents, ruleAvailable, today } = params;
  if (!ruleAvailable) {
    return {
      def,
      status: "rule_unavailable",
      reasonText: "The published rule for this item is not available in the frozen corpus.",
      evidenceFieldIds: [],
      ruleRefId: def.ruleRefId,
    };
  }
  const matchingDoc = def.requiredDocKinds.length
    ? documents.find((d) => def.requiredDocKinds.includes(d.kind))
    : undefined;
  const matchingConfirmed = confirmedFields.filter(
    (f) =>
      def.requiredFieldNames.includes(f.name) &&
      (f.status === "confirmed" || f.status === "corrected"),
  );

  let status: ChecklistStatus = "missing";
  let reason = "No matching confirmed document or field for this item.";

  if (def.requiredDocKinds.length > 0 && !matchingDoc) {
    status = "missing";
    reason = `No ${def.requiredDocKinds.join(" or ")} uploaded yet.`;
  } else if (matchingDoc && matchingDoc.expiresOn) {
    const exp = documentExpiryStatus(matchingDoc.expiresOn, today);
    if (exp.status === "expired") {
      status = "expired";
      reason = `${matchingDoc.displayName} expired on ${matchingDoc.expiresOn}.`;
    } else if (matchingConfirmed.length === 0) {
      status = "needs_confirmation";
      reason = "Document uploaded, but no fields confirmed yet.";
    } else {
      status = "confirmed";
      reason = "Document present and required field confirmed.";
    }
  } else if (matchingConfirmed.length > 0) {
    status = "confirmed";
    reason = "Required field is renter-confirmed.";
  } else if (matchingDoc && matchingConfirmed.length === 0) {
    status = "needs_confirmation";
    reason = "Document uploaded, but no fields confirmed yet.";
  }

  // Conflict detection: two paystubs with different gross values would be "conflicting"
  const conflicts =
    matchingConfirmed.length > 1 &&
    new Set(matchingConfirmed.map((f) => JSON.stringify(f.value))).size > 1;
  if (conflicts) {
    status = "conflicting";
    reason = "Two confirmed values disagree — please review.";
  }

  return {
    def,
    status,
    reasonText: reason,
    evidenceFieldIds: matchingConfirmed.map((f) => f.fieldId),
    ruleRefId: def.ruleRefId,
  };
}

export const CHECKLIST_STATUS_LABEL: Record<ChecklistStatus, string> = {
  confirmed: "Confirmed",
  needs_confirmation: "Needs confirmation",
  missing: "Missing",
  expired: "Expired",
  conflicting: "Conflicting",
  rule_unavailable: "Rule unavailable",
};
