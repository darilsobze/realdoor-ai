import { describe, it, expect } from "vitest";
import { evaluateChecklistItem } from "./checklist";
import type { ChecklistItemDef, ConfirmedField, SyntheticDocument } from "./types";

const def: ChecklistItemDef = {
  id: "chk.id",
  label: "Photo ID",
  description: "d",
  requiredFieldNames: ["id_expiry_date"],
  requiredDocKinds: ["id"],
  ruleRefId: "rule.required_documents",
};

const today = new Date("2025-10-15T00:00:00Z");

function cf(over: Partial<ConfirmedField> = {}): ConfirmedField {
  return {
    fieldId: "f",
    docId: "doc.id.1",
    name: "id_expiry_date",
    status: "confirmed",
    value: "2027-01-01",
    correctedFromProposed: false,
    confirmedAt: new Date().toISOString(),
    ...over,
  };
}
function doc(over: Partial<SyntheticDocument> = {}): SyntheticDocument {
  return {
    id: "doc.id.1",
    kind: "id",
    displayName: "ID",
    synthetic: true,
    pageImages: [],
    rawText: "",
    proposedFields: [],
    ...over,
  };
}

describe("evaluateChecklistItem — all statuses", () => {
  it("rule_unavailable when ruleAvailable=false", () => {
    const r = evaluateChecklistItem({
      def,
      confirmedFields: [],
      documents: [],
      ruleAvailable: false,
      today,
    });
    expect(r.status).toBe("rule_unavailable");
  });
  it("missing when no doc uploaded", () => {
    const r = evaluateChecklistItem({
      def,
      confirmedFields: [],
      documents: [],
      ruleAvailable: true,
      today,
    });
    expect(r.status).toBe("missing");
  });
  it("needs_confirmation when doc uploaded but no field confirmed", () => {
    const r = evaluateChecklistItem({
      def,
      confirmedFields: [],
      documents: [doc({ expiresOn: "2027-01-01" })],
      ruleAvailable: true,
      today,
    });
    expect(r.status).toBe("needs_confirmation");
  });
  it("expired when doc.expiresOn is past", () => {
    const r = evaluateChecklistItem({
      def,
      confirmedFields: [cf()],
      documents: [doc({ expiresOn: "2024-03-01" })],
      ruleAvailable: true,
      today,
    });
    expect(r.status).toBe("expired");
  });
  it("confirmed when doc present, current, and field confirmed", () => {
    const r = evaluateChecklistItem({
      def,
      confirmedFields: [cf()],
      documents: [doc({ expiresOn: "2027-01-01" })],
      ruleAvailable: true,
      today,
    });
    expect(r.status).toBe("confirmed");
  });
  it("conflicting when two confirmed values disagree", () => {
    const r = evaluateChecklistItem({
      def,
      confirmedFields: [
        cf({ fieldId: "a", value: "2027-01-01" }),
        cf({ fieldId: "b", value: "2028-01-01" }),
      ],
      documents: [doc({ expiresOn: "2027-01-01" })],
      ruleAvailable: true,
      today,
    });
    expect(r.status).toBe("conflicting");
  });
});
