// Drive the Safety Test Panel end to end: click "Run all five checks",
// wait for all to resolve, capture screenshots, and report each result.
import { chromium } from "playwright";
import { join } from "node:path";

const outDir = process.argv[2] ?? ".";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 160)); });

await page.goto("http://localhost:5173/#/safety", { waitUntil: "networkidle" });
await page.reload({ waitUntil: "networkidle" });
await page.locator('button:has-text("Run all five checks")').click();

// Each slow check does a ~30s live extraction; allow generous total budget.
await page.waitForFunction(
  () => document.querySelector('button:has-text("Running all checks…")') === null &&
        !/Running all checks/.test(document.body.innerText),
  { timeout: 240_000 },
).catch(() => {});
// Settle: wait until no "Running…" badges remain.
for (let i = 0; i < 120; i++) {
  const running = await page.locator('text=/Running…|Starting…/').count();
  if (running === 0) break;
  await page.waitForTimeout(2000);
}
await page.waitForTimeout(1000);

const summary = await page.locator('text=/of 5 checks passed/').first().innerText().catch(() => "n/a");
const badges = await page.locator('h2 ~ * , li').allInnerTexts().catch(() => []);
const proven = (await page.locator('text="Proven just now"').count());
const failed = (await page.locator('text="Check failed"').count());
const couldNot = (await page.locator('text="Could not run"').count());

await page.screenshot({ path: join(outDir, "safety-all-1280.png"), fullPage: true });
await page.setViewportSize({ width: 380, height: 850 });
await page.waitForTimeout(400);
await page.screenshot({ path: join(outDir, "safety-all-380.png"), fullPage: true });

console.log("summary:", summary.replace(/\n/g, " "));
console.log(`proven=${proven} failed=${failed} couldNotRun=${couldNot}`);
console.log("console errors:", errors.length ? errors.join(" | ") : "none");
await browser.close();
process.exit(proven === 5 ? 0 : 1);
