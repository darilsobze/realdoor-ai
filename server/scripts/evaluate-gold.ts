import "dotenv/config";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { extractDocument } from "../src/extraction/pipeline.ts";
import { provider } from "../src/extraction/provider.ts";
import { EXTRACTION_VERSION } from "../src/extraction/schema.ts";
import {
  formatGoldMetricsMarkdown,
  parseGoldJsonl,
  scoreGoldSet,
} from "../src/evaluation/gold-metrics.ts";
import {
  GOLD_EVALUATION_SCHEMA_VERSION,
  loadGoldExtractions,
  parseEvaluationMode,
} from "../src/evaluation/gold-runner.ts";
import { shutdownOcr } from "../src/ocr.ts";

const here = dirname(fileURLToPath(import.meta.url));
const serverRoot = join(here, "..");
const repositoryRoot = join(serverRoot, "..");
const goldRoot = join(
  repositoryRoot,
  "realdoor-hackathon-starter-pack",
  "synthetic_documents",
);
const documentRoot = join(goldRoot, "documents");
const goldPath = join(goldRoot, "gold", "document_gold.jsonl");
const cacheDir = join(serverRoot, "evaluation-cache");

async function main(): Promise<void> {
  const mode = parseEvaluationMode(process.argv.slice(2));
  const documents = parseGoldJsonl(await readFile(goldPath, "utf8"));
  let extractedCount = 0;
  const provenance = {
    providerName: provider.name,
    extractionVersion: EXTRACTION_VERSION,
    evaluationSchemaVersion: GOLD_EVALUATION_SCHEMA_VERSION,
  };

  try {
    const extractions = await loadGoldExtractions({
      documents,
      documentRoot,
      cacheDir,
      mode,
      providerName: provider.name,
      extractionVersion: EXTRACTION_VERSION,
      extract: async (documentId, pdf) => {
        if (!provider.isConfigured()) {
          throw new Error(
            `Extraction provider "${provider.name}" is not configured. ` +
              `${provider.configurationHint} Or rerun with --cached-only after copying a complete cache.`,
          );
        }
        extractedCount += 1;
        console.error(
          `[${extractedCount}] Extracting ${documentId} with ${provider.name}...`,
        );
        return extractDocument(documentId, pdf);
      },
    });

    const report = scoreGoldSet(documents, extractions);
    const markdown = formatGoldMetricsMarkdown(report, provenance);
    await writeFile(
      join(cacheDir, "metrics.json"),
      `${JSON.stringify({ provenance, metrics: report }, null, 2)}\n`,
    );
    await writeFile(join(cacheDir, "metrics.md"), markdown);
    process.stdout.write(markdown);
    console.error(
      `Scored ${documents.length} documents (${extractedCount} extracted, ` +
        `${documents.length - extractedCount} reused from cache).`,
    );
  } finally {
    await shutdownOcr();
  }
}

main().catch((error: unknown) => {
  console.error(`Gold evaluation failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
