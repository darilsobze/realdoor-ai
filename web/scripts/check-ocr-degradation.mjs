// Sanity check: degraded fixtures must actually hurt OCR confidence.
// Renders page 1 of each stub, runs tesseract, prints word-confidence stats.
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { readFileSync } from "node:fs";
import { createCanvas } from "@napi-rs/canvas";
import Tesseract from "tesseract.js";

const here = dirname(fileURLToPath(import.meta.url));
const docsDir = join(here, "..", "..", "data", "synthetic-docs");

async function renderPng(pdfPath) {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const standardFontDataUrl =
    pathToFileURL(join(here, "..", "node_modules", "pdfjs-dist", "standard_fonts")).href + "/";
  const pdf = await getDocument({
    data: new Uint8Array(readFileSync(pdfPath)),
    standardFontDataUrl,
    verbosity: 0,
  }).promise;
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 2.0 });
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport }).promise;
  await pdf.destroy();
  return canvas.encode("png");
}

const worker = await Tesseract.createWorker("eng");
for (const name of ["stub_clean.pdf", "stub_to_correct.pdf", "stub_degraded.pdf"]) {
  const png = await renderPng(join(docsDir, name));
  const { data } = await worker.recognize(png, {}, { blocks: true, text: true });
  const words = (data.blocks ?? [])
    .flatMap((b) => b.paragraphs)
    .flatMap((p) => p.lines)
    .flatMap((l) => l.words);
  const confs = words.map((w) => w.confidence);
  const mean = confs.reduce((a, b) => a + b, 0) / confs.length;
  const low = confs.filter((c) => c < 70).length;
  const moneyTokens = words
    .filter((w) => /[$][\d,.]+/.test(w.text))
    .map((w) => `"${w.text}"@${w.confidence.toFixed(0)}`);
  console.log(
    `${name}: words=${words.length} meanConf=${mean.toFixed(1)} <70conf=${low}\n  money: ${moneyTokens.join(" ") || "NONE"}`,
  );
}
await worker.terminate();
