// C2 extraction proof: run the full pipeline on a synthetic fixture and print
// the validated ExtractedField[] JSON.
//   npm run prove                 -> data/synthetic-docs/stub_clean.pdf
//   npm run prove -- <path.pdf>   -> any other PDF fixture
import "dotenv/config";
import { readFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { extractDocument } from "../src/extraction/pipeline.ts";
import { shutdownOcr } from "../src/ocr.ts";

const here = dirname(fileURLToPath(import.meta.url));
const defaultPdf = join(here, "..", "..", "data", "synthetic-docs", "stub_clean.pdf");
const pdfPath = process.argv[2] ? resolve(process.argv[2]) : defaultPdf;

if (!process.env.ANTHROPIC_API_KEY) {
  console.error(
    "ANTHROPIC_API_KEY is not set.\n" +
      "Copy server/.env.example to server/.env and add your key, then re-run: npm run prove",
  );
  process.exit(1);
}

console.error(`Extracting: ${pdfPath}`);
const started = Date.now();
try {
  const result = await extractDocument("proof-doc-1", new Uint8Array(readFileSync(pdfPath)));
  console.log(JSON.stringify(result, null, 2));
  const proposed = result.fields.filter((f) => f.state === "proposed");
  const abstainedFields = result.fields.filter((f) => f.state === "unresolved");
  console.error(
    `\nOK in ${((Date.now() - started) / 1000).toFixed(1)}s — ` +
      `${proposed.length} proposed (${proposed.map((f) => `${f.field_name}:${f.confidence_tier}`).join(", ")}), ` +
      `${abstainedFields.length} abstained (${abstainedFields.map((f) => f.field_name).join(", ") || "none"})`,
  );
} finally {
  await shutdownOcr();
}
