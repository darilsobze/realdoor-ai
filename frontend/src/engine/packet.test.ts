import { describe, expect, it } from "vitest";
import { buildPacketLines, renderPacketPdf } from "./packet";

const input = {
  generatedAt: "2026-07-19T00:00:00.000Z",
  profileVersion: 2,
  ruleVersion: "2026-frozen",
  checklistVersion: "checklist-2026-frozen",
  householdSize: 3,
  confirmedFields: [
    { name: "gross_pay", value: 1580, status: "corrected", documentName: "stub.pdf" },
  ],
  checklist: [
    {
      title: "Two recent pay stubs",
      status: "missing",
      explanation: "One more pay stub is required.",
    },
  ],
  selectedDocumentNames: ["stub.pdf"],
  notes: "New job started last month.",
};

describe("renter packet", () => {
  it("includes versioned confirmed content and selected attachments", () => {
    const text = buildPacketLines(input).join("\n");
    expect(text).toContain("Profile version: 2");
    expect(text).toContain("Rule version: 2026-frozen");
    expect(text).toContain("gross_pay: 1580");
    expect(text).toContain("stub.pdf");
    expect(text).toContain("Two recent pay stubs — MISSING");
    expect(text).toContain("does not decide eligibility");
  });

  it("renders a valid PDF", async () => {
    const bytes = await renderPacketPdf(input);
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
    expect(bytes.length).toBeGreaterThan(500);
  });
});
