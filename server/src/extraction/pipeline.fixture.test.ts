import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, describe, expect, it, vi } from "vitest";
import { shutdownOcr } from "../ocr.ts";

const { extractFieldsMock } = vi.hoisted(() => ({ extractFieldsMock: vi.fn() }));

vi.mock("./extract.ts", () => ({ extractFields: extractFieldsMock }));

import { extractDocument } from "./pipeline.ts";

afterAll(async () => {
  await shutdownOcr();
});

describe("stub_clean extraction regression", () => {
  it("returns at least six proposed fields using the fixture's real OCR output", async () => {
    const fixture = readFileSync(
      join(process.cwd(), "..", "data", "synthetic-docs", "stub_clean.pdf"),
    );
    extractFieldsMock.mockResolvedValue({
      document_type: "pay_stub",
      document_type_evidence: "Earnings Statement",
      fields: [
        { field_name: "employer_name", raw_text: "Beacon Light Cleaning Co.", page: 1 },
        { field_name: "pay_period_start", raw_text: "06/01/2026", page: 1 },
        { field_name: "pay_period_end", raw_text: "06/14/2026", page: 1 },
        { field_name: "pay_frequency", raw_text: "Biweekly", page: 1 },
        { field_name: "gross_pay", raw_text: "$1,580.00", page: 1 },
      ],
    });

    const result = await extractDocument("stub-clean", new Uint8Array(fixture));
    const proposed = result.fields.filter((field) => field.state === "proposed");

    expect(proposed.length).toBeGreaterThanOrEqual(6);

    // Row-set stability: document_date must always be present for a pay stub —
    // proposed when readable, an explicit abstention otherwise — regardless of
    // whether the LLM volunteered it (here the mock did not).
    const documentDate = result.fields.find((f) => f.field_name === "document_date");
    expect(documentDate).toBeDefined();
    expect(documentDate?.state).toBe("unresolved");
  });
});
