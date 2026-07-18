// PDF page rendering + word-level OCR. The same render (scale below) feeds
// both tesseract and the evidence-view PNG so bounding boxes always align.
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createCanvas } from "@napi-rs/canvas";
import Tesseract from "tesseract.js";

const here = dirname(fileURLToPath(import.meta.url));

/** Render scale: canvas pixels per PDF point. */
export const RENDER_SCALE = 2.0;

export interface OcrWord {
  text: string;
  /** 0–100 tesseract word confidence. */
  confidence: number;
  /** PDF points, origin top-left (matches contracts BBox). */
  bbox: { x: number; y: number; width: number; height: number };
  page: number;
}

export interface OcrPage {
  page: number;
  widthPts: number;
  heightPts: number;
  png: Buffer;
  words: OcrWord[];
  text: string;
}

export async function renderPdfPages(
  pdfData: Uint8Array,
): Promise<{ page: number; widthPts: number; heightPts: number; png: Buffer }[]> {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const standardFontDataUrl =
    pathToFileURL(join(here, "..", "node_modules", "pdfjs-dist", "standard_fonts")).href + "/";
  const pdf = await getDocument({
    data: pdfData,
    standardFontDataUrl,
    verbosity: 0,
  }).promise;
  const pages = [];
  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n);
    const viewport = page.getViewport({ scale: RENDER_SCALE });
    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // @napi-rs/canvas is API-compatible with the DOM canvas pdfjs expects
    const renderParams = { canvas, canvasContext: ctx, viewport } as unknown as Parameters<
      typeof page.render
    >[0];
    await page.render(renderParams).promise;
    pages.push({
      page: n,
      widthPts: viewport.width / RENDER_SCALE,
      heightPts: viewport.height / RENDER_SCALE,
      png: await canvas.encode("png"),
    });
  }
  await pdf.destroy();
  return pages;
}

let workerPromise: Promise<Tesseract.Worker> | null = null;
function getWorker(): Promise<Tesseract.Worker> {
  workerPromise ??= Tesseract.createWorker("eng");
  return workerPromise;
}

export async function shutdownOcr(): Promise<void> {
  if (workerPromise) {
    const w = await workerPromise;
    await w.terminate();
    workerPromise = null;
  }
}

/** Render every page of a PDF and OCR it into word boxes (PDF points, top-left origin). */
export async function ocrPdf(pdfData: Uint8Array): Promise<OcrPage[]> {
  const rendered = await renderPdfPages(pdfData);
  const worker = await getWorker();
  const out: OcrPage[] = [];
  for (const r of rendered) {
    const { data } = await worker.recognize(r.png, {}, { blocks: true, text: true });
    const words: OcrWord[] = (data.blocks ?? [])
      .flatMap((b) => b.paragraphs)
      .flatMap((p) => p.lines)
      .flatMap((l) => l.words)
      .map((w) => ({
        text: w.text,
        confidence: w.confidence,
        bbox: {
          x: w.bbox.x0 / RENDER_SCALE,
          y: w.bbox.y0 / RENDER_SCALE,
          width: (w.bbox.x1 - w.bbox.x0) / RENDER_SCALE,
          height: (w.bbox.y1 - w.bbox.y0) / RENDER_SCALE,
        },
        page: r.page,
      }));
    out.push({ ...r, words, text: data.text ?? words.map((w) => w.text).join(" ") });
  }
  return out;
}
