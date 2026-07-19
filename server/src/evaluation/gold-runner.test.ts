import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ExtractionResult } from "../../../web/src/contracts/index.ts";
import type { GoldDocument } from "./gold-metrics.ts";
import {
  createGoldCacheEntry,
  loadGoldExtractions,
  parseEvaluationMode,
} from "./gold-runner.ts";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function fixtureDirectory(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "realdoor-gold-runner-"));
  temporaryDirectories.push(dir);
  return dir;
}

const gold: GoldDocument = {
  document_id: "HH-001-D02",
  document_type: "pay_stub",
  file_name: "fixture.pdf",
  page_count: 1,
  page_size_points: [612, 792],
  fields: [],
};

function extraction(documentId = gold.document_id): ExtractionResult {
  return { document_id: documentId, extraction_version: "extract-v3", fields: [] };
}

const runnerContext = {
  providerName: "openai:gpt-5-mini",
  extractionVersion: "extract-v3",
};

const pdfBytes = new Uint8Array(Buffer.from("%PDF-1.7 fixture"));

describe("gold evaluator arguments", () => {
  it("selects reuse, refresh, and cached-only modes", () => {
    expect(parseEvaluationMode([])).toBe("reuse");
    expect(parseEvaluationMode(["--refresh"])).toBe("refresh");
    expect(parseEvaluationMode(["--cached-only"])).toBe("cached-only");
  });

  it("rejects unknown or conflicting arguments", () => {
    expect(() => parseEvaluationMode(["--wat"])).toThrow(/unknown argument/i);
    expect(() => parseEvaluationMode(["--refresh", "--cached-only"])).toThrow(/choose only one/i);
  });
});

describe("gold extraction cache", () => {
  it("records provider, extraction, PDF, and gold provenance", () => {
    const entry = createGoldCacheEntry({
      document: gold,
      pdf: pdfBytes,
      result: extraction(),
      ...runnerContext,
    });

    expect(entry.provenance).toMatchObject({
      cacheVersion: "gold-cache-v1",
      evaluationSchemaVersion: "gold-eval-v2",
      providerName: runnerContext.providerName,
      extractionVersion: runnerContext.extractionVersion,
    });
    expect(entry.provenance.pdfSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(entry.provenance.goldSha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it("uses a valid cached extraction without calling the provider", async () => {
    const root = await fixtureDirectory();
    const cacheDir = join(root, "cache");
    await writeFile(join(root, gold.file_name), pdfBytes);
    await mkdir(join(cacheDir, "documents"), { recursive: true });
    await writeFile(
      join(cacheDir, "documents", `${gold.document_id}.json`),
      JSON.stringify(
        createGoldCacheEntry({
          document: gold,
          pdf: pdfBytes,
          result: extraction(),
          ...runnerContext,
        }),
      ),
    );
    const extract = vi.fn();

    const results = await loadGoldExtractions({
      documents: [gold],
      documentRoot: root,
      cacheDir,
      mode: "reuse",
      extract,
      ...runnerContext,
    });

    expect(results).toEqual([extraction()]);
    expect(extract).not.toHaveBeenCalled();
  });

  it("fails cached-only mode when a document is missing", async () => {
    const root = await fixtureDirectory();
    const extract = vi.fn();
    await writeFile(join(root, gold.file_name), pdfBytes);

    await expect(
      loadGoldExtractions({
        documents: [gold],
        documentRoot: root,
        cacheDir: join(root, "cache"),
        mode: "cached-only",
        extract,
        ...runnerContext,
      }),
    ).rejects.toThrow(/missing cached extraction.*HH-001-D02/i);
    expect(extract).not.toHaveBeenCalled();
  });

  it("extracts a missing document and writes a resumable validated cache entry", async () => {
    const root = await fixtureDirectory();
    const cacheDir = join(root, "cache");
    await writeFile(join(root, gold.file_name), pdfBytes);
    const extract = vi.fn(async (documentId: string, pdf: Uint8Array) => {
      expect(documentId).toBe(gold.document_id);
      expect(Buffer.from(pdf).toString("utf8")).toContain("%PDF-1.7");
      structuredClone(pdf, { transfer: [pdf.buffer as ArrayBuffer] });
      return extraction(documentId);
    });

    const results = await loadGoldExtractions({
      documents: [gold],
      documentRoot: root,
      cacheDir,
      mode: "reuse",
      extract,
      ...runnerContext,
    });

    expect(results).toEqual([extraction()]);
    expect(extract).toHaveBeenCalledTimes(1);
    expect(
      JSON.parse(await readFile(join(cacheDir, "documents", `${gold.document_id}.json`), "utf8")),
    ).toEqual(
      createGoldCacheEntry({
        document: gold,
        pdf: pdfBytes,
        result: extraction(),
        ...runnerContext,
      }),
    );

    await expect(
      loadGoldExtractions({
        documents: [gold],
        documentRoot: root,
        cacheDir,
        mode: "cached-only",
        extract: vi.fn(),
        ...runnerContext,
      }),
    ).resolves.toEqual([extraction()]);
  });

  it("rejects a cache entry created by another provider", async () => {
    const root = await fixtureDirectory();
    const cacheDir = join(root, "cache");
    await writeFile(join(root, gold.file_name), pdfBytes);
    await mkdir(join(cacheDir, "documents"), { recursive: true });
    await writeFile(
      join(cacheDir, "documents", `${gold.document_id}.json`),
      JSON.stringify(
        createGoldCacheEntry({
          document: gold,
          pdf: pdfBytes,
          result: extraction(),
          providerName: "another-provider",
          extractionVersion: "extract-v3",
        }),
      ),
    );

    await expect(
      loadGoldExtractions({
        documents: [gold],
        documentRoot: root,
        cacheDir,
        mode: "reuse",
        extract: vi.fn(),
        ...runnerContext,
      }),
    ).rejects.toThrow(/stale cached extraction.*provider/i);
  });

  it("rejects a cache entry when the PDF contents change", async () => {
    const root = await fixtureDirectory();
    const cacheDir = join(root, "cache");
    await writeFile(join(root, gold.file_name), "%PDF-1.7 changed");
    await mkdir(join(cacheDir, "documents"), { recursive: true });
    await writeFile(
      join(cacheDir, "documents", `${gold.document_id}.json`),
      JSON.stringify(
        createGoldCacheEntry({
          document: gold,
          pdf: pdfBytes,
          result: extraction(),
          ...runnerContext,
        }),
      ),
    );

    await expect(
      loadGoldExtractions({
        documents: [gold],
        documentRoot: root,
        cacheDir,
        mode: "reuse",
        extract: vi.fn(),
        ...runnerContext,
      }),
    ).rejects.toThrow(/stale cached extraction.*PDF hash/i);
  });

  it("rejects document paths that escape the organizer directory", async () => {
    const root = await fixtureDirectory();
    const documentRoot = join(root, "documents");
    await mkdir(documentRoot);
    await writeFile(join(root, "outside.pdf"), pdfBytes);

    await expect(
      loadGoldExtractions({
        documents: [{ ...gold, file_name: "../outside.pdf" }],
        documentRoot,
        cacheDir: join(root, "cache"),
        mode: "reuse",
        extract: vi.fn(),
        ...runnerContext,
      }),
    ).rejects.toThrow(/safe PDF basename/i);
  });

  it("refresh mode replaces an existing cache entry", async () => {
    const root = await fixtureDirectory();
    const cacheDir = join(root, "cache");
    await mkdir(join(cacheDir, "documents"), { recursive: true });
    await writeFile(join(root, gold.file_name), pdfBytes);
    await writeFile(
      join(cacheDir, "documents", `${gold.document_id}.json`),
      JSON.stringify(
        createGoldCacheEntry({
          document: gold,
          pdf: pdfBytes,
          result: { ...extraction(), extraction_version: "old" },
          providerName: "old-provider",
          extractionVersion: "old",
        }),
      ),
    );
    const refreshed = { ...extraction(), extraction_version: "extract-v3" };
    const extract = vi.fn(async () => refreshed);

    const results = await loadGoldExtractions({
      documents: [gold],
      documentRoot: root,
      cacheDir,
      mode: "refresh",
      extract,
      ...runnerContext,
    });

    expect(results).toEqual([refreshed]);
    expect(extract).toHaveBeenCalledTimes(1);
  });
});
