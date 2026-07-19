import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, realpath, rename, rm, writeFile } from "node:fs/promises";
import { basename, extname, isAbsolute, join, relative, resolve } from "node:path";
import { z } from "zod";
import {
  ExtractionResultSchema,
  type ExtractionResult,
} from "../../../web/src/contracts/index.ts";
import type { GoldDocument } from "./gold-metrics.ts";

export type EvaluationMode = "reuse" | "refresh" | "cached-only";

export const GOLD_CACHE_VERSION = "gold-cache-v1";
export const GOLD_EVALUATION_SCHEMA_VERSION = "gold-eval-v2";

const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
const GoldCacheProvenanceSchema = z.strictObject({
  cacheVersion: z.literal(GOLD_CACHE_VERSION),
  evaluationSchemaVersion: z.literal(GOLD_EVALUATION_SCHEMA_VERSION),
  providerName: z.string().min(1),
  extractionVersion: z.string().min(1),
  pdfSha256: Sha256Schema,
  goldSha256: Sha256Schema,
});
const GoldCacheEntrySchema = z.strictObject({
  provenance: GoldCacheProvenanceSchema,
  result: ExtractionResultSchema,
});
export type GoldCacheEntry = z.infer<typeof GoldCacheEntrySchema>;

export function parseEvaluationMode(args: string[]): EvaluationMode {
  const supported = new Set(["--refresh", "--cached-only"]);
  const unknown = args.find((arg) => !supported.has(arg));
  if (unknown) throw new Error(`Unknown argument: ${unknown}`);
  if (args.includes("--refresh") && args.includes("--cached-only")) {
    throw new Error("Choose only one of --refresh and --cached-only.");
  }
  if (args.includes("--refresh")) return "refresh";
  if (args.includes("--cached-only")) return "cached-only";
  return "reuse";
}

export interface LoadGoldExtractionsOptions {
  documents: GoldDocument[];
  documentRoot: string;
  cacheDir: string;
  mode: EvaluationMode;
  extract: (documentId: string, pdf: Uint8Array) => Promise<ExtractionResult>;
  providerName: string;
  extractionVersion: string;
}

function cachePath(cacheDir: string, documentId: string): string {
  return join(cacheDir, "documents", `${encodeURIComponent(documentId)}.json`);
}

function sha256(value: Uint8Array | string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function createGoldCacheEntry(input: {
  document: GoldDocument;
  pdf: Uint8Array;
  result: ExtractionResult;
  providerName: string;
  extractionVersion: string;
}): GoldCacheEntry {
  return GoldCacheEntrySchema.parse({
    provenance: {
      cacheVersion: GOLD_CACHE_VERSION,
      evaluationSchemaVersion: GOLD_EVALUATION_SCHEMA_VERSION,
      providerName: input.providerName,
      extractionVersion: input.extractionVersion,
      pdfSha256: sha256(input.pdf),
      goldSha256: sha256(JSON.stringify(input.document)),
    },
    result: input.result,
  });
}

async function readCachedExtraction(
  path: string,
  expected: GoldCacheEntry,
): Promise<ExtractionResult | null> {
  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
  try {
    const cached = GoldCacheEntrySchema.parse(JSON.parse(raw));
    const comparisons: Array<[keyof GoldCacheEntry["provenance"], string]> = [
      ["cacheVersion", "cache version"],
      ["evaluationSchemaVersion", "evaluation schema version"],
      ["providerName", "provider"],
      ["extractionVersion", "extraction version"],
      ["pdfSha256", "PDF hash"],
      ["goldSha256", "gold hash"],
    ];
    const mismatch = comparisons.find(
      ([key]) => cached.provenance[key] !== expected.provenance[key],
    );
    if (mismatch) {
      throw new Error(
        `Stale cached extraction for ${expected.result.document_id}: ${mismatch[1]} mismatch. ` +
          "Rerun with --refresh.",
      );
    }
    if (cached.result.document_id !== expected.result.document_id) {
      throw new Error(`cache belongs to ${cached.result.document_id}`);
    }
    return cached.result;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Stale cached extraction")) {
      throw error;
    }
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid cached extraction for ${expected.result.document_id}: ${reason}`);
  }
}

async function readSafePdf(documentRoot: string, fileName: string): Promise<Uint8Array> {
  if (basename(fileName) !== fileName || extname(fileName).toLowerCase() !== ".pdf") {
    throw new Error(`Gold file_name must be a safe PDF basename: ${JSON.stringify(fileName)}.`);
  }
  const root = await realpath(documentRoot);
  const path = await realpath(resolve(root, fileName));
  const fromRoot = relative(root, path);
  if (fromRoot.startsWith("..") || isAbsolute(fromRoot)) {
    throw new Error(`Gold PDF resolves outside the organizer document directory: ${fileName}.`);
  }
  return new Uint8Array(await readFile(path));
}

async function writeCacheAtomically(path: string, entry: GoldCacheEntry): Promise<void> {
  const temporaryPath = `${path}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporaryPath, `${JSON.stringify(entry, null, 2)}\n`);
    await rename(temporaryPath, path);
  } finally {
    await rm(temporaryPath, { force: true });
  }
}

export async function loadGoldExtractions(
  options: LoadGoldExtractionsOptions,
): Promise<ExtractionResult[]> {
  const documentsCache = join(options.cacheDir, "documents");
  await mkdir(documentsCache, { recursive: true });
  const results: ExtractionResult[] = [];

  for (const document of options.documents) {
    const path = cachePath(options.cacheDir, document.document_id);
    const pdf = await readSafePdf(options.documentRoot, document.file_name);
    const expectedCache = createGoldCacheEntry({
      document,
      pdf,
      result: {
        document_id: document.document_id,
        extraction_version: options.extractionVersion,
        fields: [],
      },
      providerName: options.providerName,
      extractionVersion: options.extractionVersion,
    });
    if (options.mode !== "refresh") {
      const cached = await readCachedExtraction(path, expectedCache);
      if (cached) {
        results.push(cached);
        continue;
      }
      if (options.mode === "cached-only") {
        throw new Error(`Missing cached extraction for ${document.document_id}.`);
      }
    }

    const extracted = ExtractionResultSchema.parse(
      await options.extract(document.document_id, pdf),
    );
    if (extracted.document_id !== document.document_id) {
      throw new Error(
        `Extraction document id mismatch: expected ${document.document_id}, received ${extracted.document_id}.`,
      );
    }
    await writeCacheAtomically(
      path,
      GoldCacheEntrySchema.parse({
        provenance: expectedCache.provenance,
        result: extracted,
      }),
    );
    results.push(extracted);
  }

  return results;
}
