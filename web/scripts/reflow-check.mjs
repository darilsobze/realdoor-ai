// WCAG 1.4.10 reflow: no horizontal scrolling at 320px width, and at 200%
// zoom (emulated as a 640px-equivalent CSS viewport of the 1280px design).
import { chromium } from "playwright";
import { join } from "node:path";

const FIXTURE = join(process.cwd(), "..", "data", "synthetic-docs", "stub_clean.pdf");
const browser = await chromium.launch();
const problems = [];

async function checkRoutes(label, width) {
  const context = await browser.newContext({ viewport: { width, height: 900 } });
  const page = await context.newPage();
  // Populate a session so downstream routes render fully.
  await page.goto("http://localhost:5173/#/", { waitUntil: "networkidle" });
  await page.locator('input[type="file"]').setInputFiles(FIXTURE);
  await page.waitForURL(/review/, { timeout: 120_000 });
  await page.waitForSelector('[data-field="gross_pay"]', { timeout: 15_000 });
  for (const f of ["document_type", "pay_frequency", "gross_pay"]) {
    await page.locator(`[data-field="${f}"] button:has-text("Confirm this value")`).click();
    await page.waitForTimeout(120);
  }
  await page.locator('input[type="number"]').fill("3");
  await page.locator('button:has-text("Confirm household size")').click();
  await page.waitForTimeout(300);

  for (const [name, hash] of [
    ["upload", "#/"],
    ["review", "#/review"],
    ["understand", "#/understand"],
    ["packet", "#/packet"],
    ["safety", "#/safety"],
  ]) {
    await page.goto(`http://localhost:5173/${hash}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(300);
    const overflow = await page.evaluate(() => {
      const de = document.documentElement;
      return { scroll: de.scrollWidth, client: de.clientWidth };
    });
    // Allow 1px rounding slack.
    const horizontal = overflow.scroll > overflow.client + 1;
    console.log(`  ${label} ${name}: scrollW=${overflow.scroll} clientW=${overflow.client} ${horizontal ? "← HORIZONTAL SCROLL" : "ok"}`);
    if (horizontal) problems.push(`${label}/${name} overflows (${overflow.scroll}>${overflow.client})`);
  }
  await context.close();
}

console.log("## 320px width (reflow minimum)");
await checkRoutes("320px", 320);
console.log("## 640px width (≈200% zoom of the 1280 design)");
await checkRoutes("640px", 640);

console.log(`\n=== ${problems.length ? problems.length + " REFLOW PROBLEM(S)" : "NO HORIZONTAL SCROLLING — reflow clean"} ===`);
await browser.close();
process.exit(problems.length ? 1 : 0);
