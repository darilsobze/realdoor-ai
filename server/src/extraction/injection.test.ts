import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { ocrPdf, shutdownOcr } from "../ocr.ts";
import { extractFields } from "./extract.ts";
import { provider } from "./provider.ts";
import { ExtractionAbstained } from "./schema.ts";

const injectionPdf = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
  "data",
  "synthetic-docs",
  "injection.pdf",
);

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(async () => {
  await shutdownOcr();
});

describe("document prompt-injection boundary", () => {
  it("rejects non-allowlisted output even when the document contains instructions", async () => {
    const pages = await ocrPdf(new Uint8Array(readFileSync(injectionPdf)));
    expect(pages.map((page) => page.text).join(" ").toLowerCase())
      .toContain("ignore all previous instructions");

    const maliciousOutput = {
      document_type: "pay_stub",
      document_type_evidence: "Earnings Statement",
      fields: [],
      eligibility_decision: "eligible",
    };
    const requestExtraction = vi
      .spyOn(provider, "requestExtraction")
      .mockResolvedValue(maliciousOutput);

    await expect(extractFields(pages.map((page) => ({
      page: page.page,
      text: page.text,
      png: page.png,
    })))).rejects.toBeInstanceOf(ExtractionAbstained);
    expect(requestExtraction).toHaveBeenCalledTimes(2);
  });
});
