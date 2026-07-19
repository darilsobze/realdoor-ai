import { describe, expect, it } from "vitest";
import { evaluateGoldChecklist } from "./checklist";
import { GOLD_CHECKLIST } from "@/domain/gold-checklist";

describe("gold checklist", () => {
  it("flags missing requirements and expired confirmed documents", () => {
    const results = evaluateGoldChecklist({
      checklist: GOLD_CHECKLIST,
      documents: [
        {
          documentId: "stub-1",
          documentType: "pay_stub",
          documentTypeConfirmed: true,
          documentDate: "2026-01-01",
          documentDateConfirmed: true,
          conflicting: false,
        },
      ],
      householdSizeConfirmed: true,
      asOfDate: "2026-07-19",
    });

    expect(results.find((item) => item.requirement_id === "pay_stubs_recent")).toMatchObject({
      status: "expired",
      requirement_version: GOLD_CHECKLIST.checklist_version,
    });
    expect(results.find((item) => item.requirement_id === "application_summary")).toMatchObject({
      status: "missing",
    });
  });

  it("does not mark an unconfirmed date expired", () => {
    const results = evaluateGoldChecklist({
      checklist: GOLD_CHECKLIST,
      documents: [
        {
          documentId: "stub-1",
          documentType: "pay_stub",
          documentTypeConfirmed: true,
          documentDate: "2026-01-01",
          documentDateConfirmed: false,
          conflicting: false,
        },
      ],
      householdSizeConfirmed: false,
      asOfDate: "2026-07-19",
    });
    expect(results.find((item) => item.requirement_id === "pay_stubs_recent")).toMatchObject({
      status: "needs_confirmation",
    });
  });
});
