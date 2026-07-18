// Screenshot given routes at 1280px and 380px for visual review.
// Usage: node scripts/screenshot.mjs <outDir> [route ...]   (routes default to "/")
import { chromium } from "playwright";

const [outDir, ...routes] = process.argv.slice(2);
if (!outDir) {
  console.error("usage: node scripts/screenshot.mjs <outDir> [route ...]");
  process.exit(1);
}
// Accept routes with or without a leading slash (Git Bash rewrites leading "/").
const targets = (routes.length ? routes : ["/"]).map((r) => (r.startsWith("/") ? r : `/${r}`)).flatMap((route) => {
  const slug = route.replaceAll(/[^a-z0-9]+/gi, "-").replaceAll(/^-|-$/g, "") || "home";
  return [
    { name: `${slug}-1280`, route, width: 1280 },
    { name: `${slug}-380`, route, width: 380 },
  ];
});

const browser = await chromium.launch();
for (const t of targets) {
  const page = await browser.newPage({ viewport: { width: t.width, height: 900 } });
  await page.goto(`http://localhost:5173${t.route}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${outDir}/${t.name}.png`, fullPage: true });
  await page.close();
  console.log("shot:", t.name);
}
await browser.close();
