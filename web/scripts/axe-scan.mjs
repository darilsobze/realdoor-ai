// axe-core accessibility scan across every screen + key interactive states.
// Drives real routes; for review/packet/understand/safety it first runs a
// live upload+extract so the populated UI (not just empty states) is scanned.
import { chromium } from "playwright";
import { AxeBuilder } from "@axe-core/playwright";
import { join } from "node:path";

const FIXTURE = join(process.cwd(), "..", "data", "synthetic-docs", "stub_clean.pdf");
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();

async function scan(label) {
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const violations = results.violations.filter((v) => v.impact !== null);
  const summary = violations.map(
    (v) => `    [${v.impact}] ${v.id}: ${v.help} (${v.nodes.length} node(s))\n      ${v.nodes[0]?.target?.join(" ")}`,
  );
  console.log(`\n## ${label}: ${violations.length ? violations.length + " violation(s)" : "clean"}`);
  if (summary.length) console.log(summary.join("\n"));
  return violations.length;
}

let total = 0;

// 1. Upload (empty + consent)
await page.goto("http://localhost:5173/#/", { waitUntil: "networkidle" });
await page.reload({ waitUntil: "networkidle" });
total += await scan("upload");

// Populate a session for the downstream screens.
const [chooser] = await Promise.all([
  page.waitForEvent("filechooser"),
  page.locator('button:has-text("Choose a PDF")').click(),
]);
await chooser.setFiles(FIXTURE);
await page.waitForURL(/review/, { timeout: 120_000 });
await page.waitForSelector('[data-field="gross_pay"]', { timeout: 15_000 });
total += await scan("review (extracted, nothing confirmed)");

// Confirm a couple values + household size so derived panels populate.
for (const f of ["document_type", "pay_frequency", "gross_pay"]) {
  const b = page.locator(`[data-field="${f}"] button:has-text("Confirm this value")`);
  await b.scrollIntoViewIfNeeded();
  await b.click();
  await page.waitForTimeout(150);
}
await page.locator('input[type="number"]').fill("3");
await page.locator('button:has-text("Confirm household size")').click();
await page.waitForTimeout(300);
total += await scan("review (confirmed + derived panels)");

// Correction dialog open (modal a11y).
await page.locator('[data-field="gross_pay"] button:has-text("Correct")').click();
await page.locator('input#').first().fill("1620").catch(() => {});
await page.locator('button:has-text("Preview what changes")').click().catch(() => {});
await page.waitForTimeout(300);
total += await scan("review (what-will-update dialog open)");
await page.keyboard.press("Escape");
await page.waitForTimeout(200);

// Understand — the income/comparison computation traces auto-play; scan the
// SETTLED state (transient fade frames lower opacity and aren't the end state;
// reduced-motion users never see them).
await page.goto("http://localhost:5173/#/understand", { waitUntil: "networkidle" });
await page.waitForFunction(() => /under the published limit/.test(document.body.innerText), { timeout: 25000 }).catch(() => {});
await page.waitForTimeout(600);
total += await scan("understand (traces settled)");
await page.locator('button:has-text("What is the income limit")').first().click();
await page.waitForFunction(() => /\$92,580/.test(document.body.innerText), { timeout: 60_000 }).catch(() => {});
await page.waitForTimeout(600);
total += await scan("understand (answer shown)");

// Packet — checklist trace auto-plays; scan settled.
await page.goto("http://localhost:5173/#/packet", { waitUntil: "networkidle" });
await page.waitForTimeout(3200);
total += await scan("packet");

// Safety panel (idle, then one check done).
await page.goto("http://localhost:5173/#/safety", { waitUntil: "networkidle" });
total += await scan("safety (idle)");
await page.locator('button:has-text("Run this check")').first().click();
await page.waitForTimeout(2500);
total += await scan("safety (a check completed)");

console.log(`\n=== TOTAL violations across all screens: ${total} ===`);
await browser.close();
process.exit(total > 0 ? 1 : 0);
