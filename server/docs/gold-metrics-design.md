# Gold extraction metrics design

## Goal

Evaluate RealDoor extraction against the organizer's 24-document gold set and
produce reproducible field-accuracy, source-box, and abstention metrics without
scoring fields the application is prohibited from extracting.

## Design

- Keep pure scoring logic in `src/evaluation/gold-metrics.ts` and cover it with
  unit tests.
- Use `scripts/evaluate-gold.ts` as the CLI. It runs extraction when requested,
  stores one validated result per document in an ignored cache directory, and
  can rescore cached results without OpenAI calls.
- Score only allowlisted, gold-annotated targets. Map `pay_date` to
  `document_date` and `monthly_benefit` to `benefit_amount`. Score the top-level
  gold `document_type` as a classification; exclude it from box metrics.
- Report unscorable allowlisted fields such as `employer_name` separately.
- Convert gold boxes from bottom-left `[x1,y1,x2,y2]` PDF coordinates to the
  top-left `{x,y,width,height}` PDF coordinates emitted by RealDoor.
- Box metrics are mean IoU and the percentage of scorable boxes with IoU at
  least 0.5. Missing/abstained boxes contribute IoU zero.
- Field accuracy is exact normalized-value matches divided by scorable targets;
  abstentions count as incorrect. Abstention rate is abstained scorable targets
  divided by scorable targets.
- Write machine-readable JSON and a concise Markdown summary to the cache, and
  print the Markdown summary to stdout.

## Failure handling

The CLI fails non-zero for malformed gold data, missing PDFs, invalid cache
records, provider configuration errors, or per-document extraction failures.
Partial extraction results remain cached so a later run can resume.

## Verification

Unit tests cover aliases, normalization, coordinate conversion, IoU, abstention
denominators, document-type classification, and aggregate metrics. The existing
server test suite and typecheck must also pass. A live 24-document run is the
final acceptance check when an API key is available.
