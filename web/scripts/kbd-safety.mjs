// Keyboard-only check: tab to the first "Run this check" and activate it,
// confirm focus is visible and the check runs.
import { chromium } from "playwright";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto("http://localhost:5173/#/safety", { waitUntil: "networkidle" });
await page.reload({ waitUntil: "networkidle" });

// Tab until focus lands on the first per-check "Run this check" button.
let landed = false;
for (let i = 0; i < 12; i++) {
  await page.keyboard.press("Tab");
  const label = await page.evaluate(() => document.activeElement?.textContent?.trim() ?? "");
  if (/^Run this check/.test(label)) { landed = true; break; }
}
const outline = await page.evaluate(() => {
  const el = document.activeElement;
  if (!el) return "no-focus";
  const s = getComputedStyle(el);
  return `${s.outlineWidth} ${s.outlineStyle}`;
});
await page.keyboard.press("Enter");
await page.waitForTimeout(1500);
const badge = await page.locator("li").first().locator('text=/Running…|Proven just now|Starting…/').first().innerText().catch(() => "none");
console.log(`reached run button via Tab: ${landed}`);
console.log(`focus outline: ${outline}`);
console.log(`after Enter, first check state: ${badge}`);
await browser.close();
process.exit(landed ? 0 : 1);
