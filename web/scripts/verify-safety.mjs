// C7 acceptance: run all five safety checks live, require 5/5 PASS.
// Usage: node scripts/verify-safety.mjs <outDir>
import { chromium } from "playwright";
import { join } from "node:path";

const outDir = process.argv[2] ?? ".";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

