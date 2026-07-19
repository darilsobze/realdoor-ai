#!/usr/bin/env node
/**
 * Copy lint: fails if forbidden decisioning phrases appear in source code
 * outside allowlisted files (where refusal patterns and demo strings live).
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = new URL("../src", import.meta.url).pathname;
const ALLOWLIST = new Set([
  "domain/safety.ts",
  "domain/safety.test.ts",
  "routes/safety.tsx",
  "routes/safety.index.tsx",
  "routes/safety.profile.tsx",
  "routes/understand.tsx", // contains neutral "eligibility" mentions in refusal UI
  "routes/index.tsx", // contains the negation "does not decide eligibility"
  "routes/__root.tsx",
  "routes/prepare.tsx", // human-decision statement mentions "eligibility decision"
  "domain/program-config.ts", // rule-limitation copy: "does not decide whether any household is eligible"
]);

const PATTERNS = [
  { re: /\beligible\b/i, name: "eligible" },
  { re: /\bineligible\b/i, name: "ineligible" },
  { re: /readiness score/i, name: "readiness score" },
  { re: /acceptance probability/i, name: "acceptance probability" },
  { re: /applicant ranking/i, name: "applicant ranking" },
  { re: /likely to qualify/i, name: "likely to qualify" },
];

let failures = 0;

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const s = statSync(p);
    if (s.isDirectory()) walk(p);
    else if (/\.(tsx?|jsx?|md|mdx)$/.test(entry)) inspect(p);
  }
}

function inspect(path) {
  const rel = relative(ROOT, path).replace(/\\/g, "/");
  if (ALLOWLIST.has(rel)) return;
  const text = readFileSync(path, "utf8");
  text.split("\n").forEach((line, i) => {
    for (const p of PATTERNS) {
      if (p.re.test(line)) {
        console.error(`FORBIDDEN "${p.name}" at src/${rel}:${i + 1}: ${line.trim()}`);
        failures++;
      }
    }
  });
}

walk(ROOT);
if (failures) {
  console.error(`\ncopy-lint failed with ${failures} occurrence(s).`);
  process.exit(1);
} else {
  console.log("copy-lint OK.");
}
