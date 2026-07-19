import { describe, expect, it } from "vitest";
import goldJson from "../../../data/checklist/gold.json";
import {
  ChecklistResultSchema,
  GoldChecklistFileSchema,
  type ChecklistResult,
} from "../contracts/checklist";
import {
  evaluateChecklist,
  type ChecklistDocumentMetadata,
} from "./checklist";

const checklist = GoldChecklistFileSchema.parse(goldJson);
const asOfDate = "2026-07-18";

function document(
  overrides: Partial<ChecklistDocumentMetadata> = {},
): ChecklistDocumentMetadata {
  return {
    documentId: "DOC-1",
    documentType: "application_summary",
    documentTypeConfirmed: true,
    documentDate: "2026-07-10",
    documentDateConfirmed: true,
    conflicting: false,
    ...overrides,
  };
}

function results(
  documents: ChecklistDocumentMetadata[],
  householdSizeConfirmed = true,
): ChecklistResult[] {
  return evaluateChecklist({
    checklist,
    documents,
    attestations: { householdSizeConfirmed },
    asOfDate,
  });
}

function resultFor(allResults: ChecklistResult[], requirementId: string): ChecklistResult {
  const result = allResults.find((item) => item.requirement_id === requirementId);
  if (!result) throw new Error(`Missing result for ${requirementId}`);
  return result;
}

describe("evaluateChecklist", () => {
  it("returns schema-valid frozen ChecklistResult records", () => {
    const output = results([document()]);
    expect(output).toHaveLength(checklist.requirements.length);
    expect(ChecklistResultSchema.array().safeParse(output).success).toBe(true);
    expect(output.every((item) => item.explanation.length > 0)).toBe(true);
    expect(output.every((item) => item.requirement_version === checklist.checklist_version)).toBe(true);
  });

  it("confirms enough current matching documents and records their ids", () => {
    const output = results([
      document({ documentId: "PAY-1", documentType: "pay_stub", documentDate: "2026-06-27" }),
      document({ documentId: "PAY-2", documentType: "pay_stub", documentDate: "2026-06-20" }),
    ]);
    expect(resultFor(output, "pay_stubs_recent")).toMatchObject({
      status: "confirmed",
      matched_document_ids: ["PAY-1", "PAY-2"],
    });
  });

  it("makes an unconfirmed matching document needs_confirmation instead of counting or excluding it", () => {
    const output = results([
      document({
        documentId: "UNCONFIRMED-SUMMARY",
        documentTypeConfirmed: false,
      }),
    ]);
    expect(resultFor(output, "application_summary")).toEqual({
      requirement_id: "application_summary",
      requirement_version: checklist.checklist_version,
      status: "needs_confirmation",
      explanation: "A matching document type needs confirmation before it can count.",
      matched_document_ids: ["UNCONFIRMED-SUMMARY"],
    });
  });

  it("makes an unconfirmed date needs_confirmation, never expired", () => {
    const output = results([
      document({ documentId: "DATE-UNKNOWN", documentDate: "2026-01-01", documentDateConfirmed: false }),
    ]);
    expect(resultFor(output, "application_summary")).toMatchObject({
      status: "needs_confirmation",
      matched_document_ids: ["DATE-UNKNOWN"],
    });
  });

  it("marks the HH-004 gig corroboration requirement missing", () => {
    const output = results([
      document({
        documentId: "HH-004-D04",
        documentType: "gig_statement",
        documentDate: "2026-06-30",
      }),
    ]);
    expect(resultFor(output, "gig_income_corroboration")).toMatchObject({
      status: "missing",
      matched_document_ids: [],
    });
  });

  it("marks hh-005_d04_employment_letter.pdf expired", () => {
    const output = results([
      document({ documentId: "HH-005-D02", documentType: "pay_stub", documentDate: "2026-06-27" }),
      document({
        documentId: "HH-005-D04",
        documentType: "employment_letter",
        documentDate: "2026-04-14",
      }),
    ]);
    expect(resultFor(output, "employment_letter")).toMatchObject({
      status: "expired",
      matched_document_ids: ["HH-005-D04"],
    });
  });

  it("reports conflicting matching documents", () => {
    const output = results([document({ documentId: "CONFLICT", conflicting: true })]);
    expect(resultFor(output, "application_summary")).toMatchObject({
      status: "conflicting",
      matched_document_ids: ["CONFLICT"],
    });
  });

  it("marks conditional requirements not applicable when their source is absent", () => {
    const output = results([document()]);
    expect(resultFor(output, "employment_letter").status).toBe("not_applicable");
    expect(resultFor(output, "benefit_letter_current").status).toBe("not_applicable");
    expect(resultFor(output, "gig_income_corroboration").status).toBe("not_applicable");
  });

  it("requires household-size confirmation", () => {
    expect(resultFor(results([], false), "household_size_confirmation")).toMatchObject({
      status: "needs_confirmation",
      matched_document_ids: [],
    });
    expect(resultFor(results([], true), "household_size_confirmation").status).toBe("confirmed");
  });

  it("does not mutate its documents or frozen checklist inputs", () => {
    const documents = [document()];
    const before = JSON.stringify({ checklist, documents });
    results(documents);
    expect(JSON.stringify({ checklist, documents })).toBe(before);
  });
});
