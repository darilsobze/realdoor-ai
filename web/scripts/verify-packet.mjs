// C5 acceptance: drive upload -> confirm -> packet preview -> keyboard
// download, then assert the PDF matches the preview on sections, values,
// order, and manifest. Usage: node scripts/verify-packet.mjs <outDir>
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const outDir = process.argv[2] ?? ".";
const FIXTURE = join(process.cwd(), "..", "data", "synthetic-docs", "stub_clean.pdf");
const SECTIONS = ["Cover", "Confirmed values", "Calculation sheet", "Checklist", "Unresolved items", "Manifest"];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

// 1) upload + extract
await page.goto("http://localhost:5173/#/", { waitUntil: "networkidle" });
const [chooser] = await Promise.all([
  page.waitForEvent("filechooser"),
  page.locator('button:has-text("Choose a PDF")').click(),
]);
await chooser.setFiles(FIXTURE);
await page.waitForURL(/review/, { timeout: 120_000 });
await page.waitForSelector('[data-field="gross_pay"]', { timeout: 15_000 });
console.log("extracted");

// 2) confirm the chain + household size
for (const f of ["document_type", "document_date", "pay_frequency", "gross_pay"]) {
  const b = page.locator(`[data-field="${f}"] button:has-text("Confirm this value")`);
  await b.scrollIntoViewIfNeeded();
  await b.click();
  await page.waitForTimeout(200);
}
await page.locator('input[type="number"]').fill("3");
await page.locator('button:has-text("Confirm household size")').click();
await page.waitForTimeout(300);
console.log("confirmed");

// 3) packet preview
await page.goto("http://localhost:5173/#/packet", { waitUntil: "networkidle" });
await page.waitForSelector("[data-collect-target]", { timeout: 10_000 });
await page.waitForTimeout(700);
// Parity text must be present at rest, even with the pages in the 3D ring.
const previewText = await page.locator("main").innerText();
await page.screenshot({ path: join(outDir, "packet-1280.png"), fullPage: true });
await page.setViewportSize({ width: 380, height: 850 });
await page.waitForTimeout(300);
await page.screenshot({ path: join(outDir, "packet-380.png"), fullPage: true });
await page.setViewportSize({ width: 1280, height: 900 });

// 4) collect every page (download is gated until all six are in the packet)
const adds = page.locator("[data-card-add]");
const cardCount = await adds.count();
for (let i = 0; i < cardCount; i++) {
  const add = adds.nth(i);
  await add.focus();
  if (/Add to packet/.test(await add.innerText())) {
    await page.keyboard.press("Enter");
    await page.waitForTimeout(150);
  }
}

// keyboard-only: include the document, then download
const checkbox = page.locator('input[type="checkbox"], [role="checkbox"]').first();
await checkbox.focus();
await page.keyboard.press("Space");
await page.waitForTimeout(200);
const downloadBtn = page.locator('button:has-text("Download my packet")').first();
await downloadBtn.focus();
const [download] = await Promise.all([
  page.waitForEvent("download", { timeout: 60_000 }),
  page.keyboard.press("Enter"),
]);
const pdfPath = join(outDir, "packet-download.pdf");
await download.saveAs(pdfPath);
console.log("downloaded:", download.suggestedFilename());

// 5) parity: extract PDF text
const pdf = await getDocument({ data: new Uint8Array(readFileSync(pdfPath)), verbosity: 0 }).promise;
const numPages = pdf.numPages;
let pdfText = "";
for (let i = 1; i <= numPages; i++) {
  const content = await (await pdf.getPage(i)).getTextContent();
  pdfText += content.items.map((it) => it.str).join(" ") + "\n";
}
await pdf.destroy();

const problems = [];
// Cover is rendered as a cover page (no "Cover" heading) — verify by content.
if (!/not an eligibility decision/i.test(pdfText)) problems.push("pdf cover missing disclaimer");
// The 5 content-section headers must appear in manifest order in the PDF.
// Advance a cursor so each header is found at/after the previous one; the
// manifest's "Sections:" recap lists them too but comes last, so real headers win.
const CONTENT = SECTIONS.filter((s) => s !== "Cover");
let cursor = 0;
for (const s of CONTENT) {
  if (!previewText.includes(s)) problems.push(`preview missing section: ${s}`);
  const at = pdfText.indexOf(s, cursor);
  if (at === -1) problems.push(`pdf section out of order or missing: ${s}`);
  else cursor = at + s.length;
}
// same key values in both — now humanized (labels, formatted values, titles)
const mustContain = ["Gross pay", "$1,580.00", "41080.00", "92580.00", "not an eligibility decision", "Two recent pay stubs"];
for (const v of mustContain) {
  if (!previewText.toLowerCase().includes(v.toLowerCase())) problems.push(`preview missing value: ${v}`);
  if (!pdfText.toLowerCase().includes(v.toLowerCase())) problems.push(`pdf missing value: ${v}`);
}
// manifest agreement: profile version line identical in both
const mv = pdfText.match(/Profile version:\s*(\d+)/);
const pv = previewText.match(/Profile version:\s*(\d+)/);
if (!mv || !pv || mv[1] !== pv[1]) problems.push(`profile version mismatch: pdf=${mv?.[1]} preview=${pv?.[1]}`);
// attachment page appended (document was selected): PDF should have >1 page
if (numPages < 2) problems.push(`expected attachment page, PDF has ${numPages} page(s)`);

console.log(problems.length === 0 ? "PARITY: PASS" : `PARITY: FAIL\n- ${problems.join("\n- ")}`);
console.log(`pdf pages: ${numPages}`);
await browser.close();
process.exit(problems.length === 0 ? 0 : 1);
