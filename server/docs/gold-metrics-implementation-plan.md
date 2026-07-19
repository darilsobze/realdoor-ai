# Gold Extraction Metrics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a reproducible evaluator for field accuracy, source-box IoU, and abstention rate over the organizer's 24-document gold set.

**Architecture:** A pure TypeScript scorer owns gold parsing, aliases, value normalization, coordinate conversion, IoU, and aggregation. A thin CLI owns live extraction, per-document caching, resume behavior, and JSON/Markdown reports.

**Tech Stack:** TypeScript, Zod, Vitest, tsx, existing OCR/extraction pipeline.

---

## File structure

- Create `src/evaluation/gold-metrics.ts`: gold schemas, target construction, scoring, IoU, report formatting.
- Create `src/evaluation/gold-metrics.test.ts`: deterministic scorer tests with no OCR or API calls.
- Create `scripts/evaluate-gold.ts`: cache-aware 24-document CLI.
- Create `.gitignore`: ignore `evaluation-cache/` generated outputs.
- Modify `package.json`: add `evaluate:gold` script.

### Task 1: Pure metric primitives

**Files:**
- Create: `src/evaluation/gold-metrics.ts`
- Test: `src/evaluation/gold-metrics.test.ts`

- [ ] **Step 1: Write failing tests for coordinate conversion and IoU**

```ts
it("converts bottom-left gold boxes to top-left PDF points", () => {
  expect(goldBoxToTopLeft([40, 658, 94, 672], 792)).toEqual({
    x: 40, y: 120, width: 54, height: 14,
  });
});

it("computes intersection over union", () => {
  expect(intersectionOverUnion(
    { x: 0, y: 0, width: 10, height: 10 },
    { x: 5, y: 0, width: 10, height: 10 },
  )).toBeCloseTo(1 / 3);
});
```

- [ ] **Step 2: Run the focused test and confirm it fails**

Run: `npm test -- src/evaluation/gold-metrics.test.ts`

Expected: FAIL because `goldBoxToTopLeft` and `intersectionOverUnion` do not exist.

- [ ] **Step 3: Implement coordinate conversion and IoU**

```ts
export function goldBoxToTopLeft([x1, y1, x2, y2]: GoldBox, pageHeight: number): BBox {
  return { x: x1, y: pageHeight - y2, width: x2 - x1, height: y2 - y1 };
}

export function intersectionOverUnion(a: BBox, b: BBox): number {
  const intersectionWidth = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
  const intersectionHeight = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  const intersection = intersectionWidth * intersectionHeight;
  const union = a.width * a.height + b.width * b.height - intersection;
  return union > 0 ? intersection / union : 0;
}
```

- [ ] **Step 4: Run the focused test and confirm it passes**

Run: `npm test -- src/evaluation/gold-metrics.test.ts`

Expected: both tests PASS.

### Task 2: Gold targets and aggregate scoring

**Files:**
- Modify: `src/evaluation/gold-metrics.ts`
- Modify: `src/evaluation/gold-metrics.test.ts`

- [ ] **Step 1: Write failing tests for aliases and classification**

Cover these exact cases:

```ts
expect(buildGoldTargets(payStubGold).map((target) => target.fieldName)).toContain("document_date");
expect(buildGoldTargets(benefitGold).map((target) => target.fieldName)).toContain("benefit_amount");
expect(buildGoldTargets(payStubGold).find((target) => target.fieldName === "document_type")).toMatchObject({
  expectedValue: "pay_stub",
  goldBox: null,
});
```

Also assert that `person_name`, `net_pay`, and `untrusted_instruction_text` never become targets.

- [ ] **Step 2: Run the focused test and confirm it fails**

Run: `npm test -- src/evaluation/gold-metrics.test.ts`

Expected: FAIL because target construction is missing.

- [ ] **Step 3: Implement validated gold parsing and target construction**

Define Zod schemas for the fields consumed by scoring. Use this explicit alias map:

```ts
const GOLD_FIELD_ALIASES: Readonly<Record<string, FieldName>> = {
  pay_date: "document_date",
  monthly_benefit: "benefit_amount",
};
```

Directly include gold field names present in `FIELD_ALLOWLIST`, add one top-level `document_type` target per document, and exclude all other gold fields.

- [ ] **Step 4: Write failing aggregate tests**

Use two synthetic documents and assert:

- exact normalized values count as correct;
- missing or `unresolved` predictions count as abstentions and incorrect;
- a wrong value contributes IoU zero even if a box overlaps;
- a correct value with IoU `0.5` counts as a box hit;
- classification targets are excluded from box denominators;
- `employer_name` is listed in `unscorableAllowlistedFields`.

- [ ] **Step 5: Implement `scoreGoldSet`**

Return this stable structure:

```ts
interface GoldMetricsReport {
  documents: number;
  field: { targets: number; correct: number; accuracy: number; abstained: number; abstentionRate: number };
  box: { targets: number; meanIou: number; iouAt50: number; iouAt50Rate: number };
  unscorableAllowlistedFields: FieldName[];
  details: GoldTargetResult[];
}
```

Match predictions by document ID and field name. Compare normalized numbers exactly as finite numbers and strings after trimming/lowercasing. For box scoring, require a correct value, matching page, and non-null predicted box; otherwise use IoU zero.

- [ ] **Step 6: Run focused tests**

Run: `npm test -- src/evaluation/gold-metrics.test.ts`

Expected: all scorer tests PASS.

- [ ] **Step 7: Commit the pure scorer milestone**

```bash
git add server/src/evaluation/gold-metrics.ts server/src/evaluation/gold-metrics.test.ts
git commit -m "feat(server): score extraction against gold data"
```

### Task 3: Cache-aware CLI and reports

**Files:**
- Create: `scripts/evaluate-gold.ts`
- Create: `.gitignore`
- Modify: `package.json`
- Modify: `src/evaluation/gold-metrics.ts`
- Modify: `src/evaluation/gold-metrics.test.ts`

- [ ] **Step 1: Write a failing Markdown formatter test**

Assert `formatGoldMetricsMarkdown(report)` contains document count, `correct/targets`, percentage field accuracy, mean IoU, IoU-at-0.5 rate, abstention rate, and unscorable fields.

- [ ] **Step 2: Implement the formatter and run focused tests**

Run: `npm test -- src/evaluation/gold-metrics.test.ts`

Expected: all scorer and formatter tests PASS.

- [ ] **Step 3: Implement CLI argument and cache behavior**

Support:

```text
npm run evaluate:gold             # reuse cache, extract missing documents
npm run evaluate:gold -- --refresh # extract all documents again
npm run evaluate:gold -- --cached-only # fail if any cache entry is missing
```

Read the gold JSONL and document paths from `../realdoor-hackathon-starter-pack/synthetic_documents/`. Cache each validated `ExtractionResult` immediately at `evaluation-cache/documents/<document_id>.json`. Write `metrics.json` and `metrics.md` after scoring. Always call `shutdownOcr()` in `finally`.

- [ ] **Step 4: Add the package script and ignored cache directory**

Add to `package.json`:

```json
"evaluate:gold": "tsx scripts/evaluate-gold.ts"
```

Add to `.gitignore`:

```gitignore
evaluation-cache/
```

- [ ] **Step 5: Verify cache-only failure without cached data**

Run: `npm run evaluate:gold -- --cached-only`

Expected: non-zero exit with a concise message naming the first missing document cache; no API call.

- [ ] **Step 6: Commit the CLI milestone**

```bash
git add server/scripts/evaluate-gold.ts server/src/evaluation/gold-metrics.ts server/src/evaluation/gold-metrics.test.ts server/package.json server/.gitignore
git commit -m "feat(server): add cache-aware gold evaluation CLI"
```

### Task 4: Full verification

- [ ] **Step 1: Run server tests**

Run: `npm test`

Expected: all tests PASS.

- [ ] **Step 2: Run TypeScript validation**

Run: `npm run typecheck`

Expected: exit 0 with no diagnostics.

- [ ] **Step 3: Run the live gold evaluation when configured**

Run: `npm run evaluate:gold`

Expected: 24 cached document results plus `metrics.json` and `metrics.md`; the summary prints to stdout. If `OPENAI_API_KEY` is unavailable, report the live run as blocked and verify `--cached-only` behavior instead.

- [ ] **Step 4: Confirm only intended files changed**

Run: `git status --short` and `git diff --check`.

Expected: only planned server files, with no whitespace errors or generated cache files tracked.
