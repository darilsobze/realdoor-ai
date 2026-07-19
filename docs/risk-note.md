# RealDoor — Risk & Responsibility Note

> Finalized 2026-07-19. Every risk control below runs live in-app on the Safety panel (`#/safety`, "Run all five checks").

## What this system is and is not
RealDoor is an assistive application-readiness copilot. It extracts document evidence, explains one program's published rules with citations, performs deterministic calculations on renter-confirmed values, and prepares a renter-controlled packet. It never approves, denies, scores, ranks, or determines eligibility — by architecture, not by disclaimer: no code path produces a decision, and the deterministic engine has no eligibility output type.

## Feature register (complete — no hidden features or proxies)
| Feature | Purpose | Decisioning? |
|---|---|---|
| Confirmed household size | Select official threshold table row | No |
| Confirmed income amounts + frequency | Annualization input | No |
| Document date | Freshness vs checklist | No |
| Document type | Match to checklist requirement | No |
| Rule version / effective date | Reproducibility | No |

No demographic, behavioral, neighborhood-inference, or landlord-revenue features exist. Public datasets are not used to profile applicants or infer protected traits.

## Risk controls (each demonstrated live — Safety panel `#/safety`, and demo-script step 6)
- **Automated decisioning** → refusal + redirect to rule/confirmed input/calculation; no score anywhere; explicit statuses instead.
- **Prompt injection via documents** → document text is untrusted data: schema-constrained extraction limited to a field allowlist; validation rejects everything else; document content never reaches system instructions or tools. Tested with injection.pdf.
- **Hallucinated rules/thresholds** → frozen versioned corpus; UI numbers come from deterministic lookup, not LLM text; abstention when the corpus doesn't cover a question.
- **Unconfirmed data reuse** → confirmation gate: calculations, checklist, and packet consume only renter-confirmed values; blocked states explain what's missing.
- **Privacy** → synthetic documents only; session-isolated storage; short retention; real deletion of files and derived data (demonstrated); audit log stores consent/actions/rule versions, never raw document content; no training on uploads; export is renter-initiated download only.
- **Accessibility exclusion** → WCAG 2.2 AA target; keyboard-complete journey; icon+text statuses; tested with axe-core + keyboard runs.

## Known limitations (honest by design)
- One metro (Boston-Cambridge-Quincy, MA-NH HMFA), one program (LIHTC), one rule year (2026); results do not generalize beyond the frozen corpus (`data/rules/rules.json`, corpus_version `2026-frozen-2026-07-18`, effective 2026-05-01).
- Rules carrying authority `hackathon_simulation` are challenge conventions, labeled as such in the UI and packet — never presented as official program rules.
- OCR quality bounds extraction on degraded scans; the system abstains rather than guesses (extraction is deterministic — seeded, canonical field order — but tesseract output can still vary per host, so accuracy is reported on the demo machine).
- Checklist reflects the provided gold reference, not every property's individual requirements.
- The packet aids preparation; a qualified human reviewer makes all determinations.

## Residual risks & mitigations
- A renter might read the threshold comparison as a verdict → mitigation: disclaimer as body text at the point of comparison and on the packet cover; language avoids "eligible/qualify" everywhere.
- Confirmed-but-wrong values (renter confirms an incorrect number) → mitigation: evidence highlight shown at confirmation time; every value remains correctable; original model output preserved for audit.

## AI model disclosure (per license manifest MODEL-NONE — participant disclosure required)
- **Provider / model:** OpenAI, `gpt-5-mini`, via the OpenAI API (chat completions, Structured Outputs `strict: true`). No model weights are bundled.
- **Where used:** two tasks only — schema-constrained field extraction and rules-corpus Q&A explanation — both behind `server/src/extraction/provider.ts` / `server/src/rules/provider.ts`. The LLM never performs arithmetic, supplies threshold numbers, or emits a decision; deterministic code in `web/src/engine/` does all math and all threshold lookups.
- **Determinism:** both calls run with a fixed `seed` and `reasoning_effort: "medium"` for reproducible demo behavior.
- **Key handling & retention:** `OPENAI_API_KEY` lives only in `server/.env` (gitignored), never exposed to the browser and never echoed in client error responses. OpenAI's API data-usage policy states API inputs/outputs are not used to train its models by default; teams requiring stricter handling should confirm zero-retention terms with OpenAI. All uploads here are synthetic.
- **Switch-back seam:** an Anthropic provider (`@anthropic-ai/sdk`) is retained behind the same seam for a one-line swap but is not active in this build.

## Licenses
- **Data:** HUD FY2026 MTSP limits and HUD/Census LIHTC records are U.S. federal-government sources (generally not subject to U.S. copyright, 17 U.S.C. §105); attribution and non-vacancy/accuracy caveats preserved. Synthetic document fixtures + gold labels are organizer-provided for event use. Both carry `organizer_review_required` / `pending_organizer_approval` status per `realdoor-hackathon-starter-pack/governance/LICENSE_MANIFEST.csv`.
- **Model:** OpenAI API commercial terms (see disclosure above).
- **Code dependencies:** all top-level runtime dependencies are permissive — MIT (react, express, pdf-lib, zod, radix-ui, tailwindcss, multer, @napi-rs/canvas, @anthropic-ai/sdk, …), Apache-2.0 (openai, tesseract.js, pdfjs-dist, class-variance-authority), BSD-2-Clause (dotenv), ISC (lucide-react), OFL-1.1 (Inter font). No copyleft (GPL/AGPL) dependencies. Enumerated from installed `package.json` license fields; regenerate with `license-checker` for a full transitive list before publication.
- **PDF Base-14 fonts** are referenced through the PDF standard, not embedded as external font files.
