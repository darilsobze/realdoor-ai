import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  ExtractionResultSchema,
  type ExtractionResult,
} from "../../../web/src/contracts/index.ts";
import type { GoldDocument } from "./gold-metrics.ts";

export type EvaluationMode = "reuse" | "refresh" | "cached-only";

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
}

function cachePath(cacheDir: string, documentId: string): string {
  return join(cacheDir, "documents", `${encodeURIComponent(documentId)}.json`);
}

async function readCachedExtraction(
  path: string,
  documentId: string,
): Promise<ExtractionResult | null> {
  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
  try {
    const result = ExtractionResultSchema.parse(JSON.parse(raw));
    if (result.document_id !== documentId) {
      throw new Error(`cache belongs to ${result.document_id}`);
    }
    return result;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid cached extraction for ${documentId}: ${reason}`);
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
    if (options.mode !== "refresh") {
      const cached = await readCachedExtraction(path, document.document_id);
      if (cached) {
        results.push(cached);
        continue;
      }
      if (options.mode === "cached-only") {
        throw new Error(`Missing cached extraction for ${document.document_id}.`);
      }
    }

    const pdf = await readFile(join(options.documentRoot, document.file_name));
    const extracted = ExtractionResultSchema.parse(
      await options.extract(document.document_id, new Uint8Array(pdf)),
    );
    if (extracted.document_id !== document.document_id) {
      throw new Error(
        `Extraction document id mismatch: expected ${document.document_id}, received ${extracted.document_id}.`,
      );
    }
    await writeFile(path, `${JSON.stringify(extracted, null, 2)}\n`);
    results.push(extracted);
  }

  return results;
}
