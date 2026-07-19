import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { ocrPdf, renderPdfPages, shutdownOcr } from "./ocr.ts";

const organizerDocuments = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "realdoor-hackathon-starter-pack",
  "synthetic_documents",
  "documents",
);

describe("renderPdfPages", () => {
  it("renders an organizer vector PDF with the expected page geometry", async () => {
    const pdf = new Uint8Array(
      readFileSync(join(organizerDocuments, "hh-001_d01_application_summary.pdf")),
    );

    const pages = await renderPdfPages(pdf);

    expect(pages).toHaveLength(1);
    expect(pages[0]).toMatchObject({ page: 1, widthPts: 612, heightPts: 792 });
    expect(pages[0].png.subarray(1, 4).toString("latin1")).toBe("PNG");
  });

  it("continues to render an organizer rasterized PDF", async () => {
    const pdf = new Uint8Array(
      readFileSync(join(organizerDocuments, "hh-001_d02_pay_stub.pdf")),
    );

    const pages = await renderPdfPages(pdf);

    expect(pages).toHaveLength(1);
    expect(pages[0]).toMatchObject({ page: 1, widthPts: 612, heightPts: 792 });
    expect(pages[0].png.subarray(1, 4).toString("latin1")).toBe("PNG");
  });
});

describe("ocrPdf", () => {
  afterAll(async () => {
    await shutdownOcr();
  });

  it("returns word-level evidence boxes for an organizer vector PDF", async () => {
    const pdf = new Uint8Array(
      readFileSync(join(organizerDocuments, "hh-001_d01_application_summary.pdf")),
    );

    const pages = await ocrPdf(pdf);

    expect(pages[0].text).toContain("Mara North");
    expect(pages[0].words.length).toBeGreaterThan(0);
    expect(pages[0].words.every((word) =>
      word.bbox.x >= 0 &&
      word.bbox.y >= 0 &&
      word.bbox.x + word.bbox.width <= pages[0].widthPts &&
      word.bbox.y + word.bbox.height <= pages[0].heightPts
    )).toBe(true);
  });
});
