# RealDoor — Risk & Responsibility Note (required deliverable — append as you build, finalize in Phase 9)

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

## Risk controls (each demonstrated live — see docs/demo-script.md step 6)
- **Automated decisioning** → refusal + redirect to rule/confirmed input/calculation; no score anywhere; explicit statuses instead.
- **Prompt injection via documents** → document text is untrusted data: schema-constrained extraction limited to a field allowlist; validation rejects everything else; document content never reaches system instructions or tools. Tested with injection.pdf.
- **Hallucinated rules/thresholds** → frozen versioned corpus; UI numbers come from deterministic lookup, not LLM text; abstention when the corpus doesn't cover a question.
- **Unconfirmed data reuse** → confirmation gate: calculations, checklist, and packet consume only renter-confirmed values; blocked states explain what's missing.
- **Privacy** → synthetic documents only; session-isolated storage; short retention; real deletion of files and derived data (demonstrated); audit log stores consent/actions/rule versions, never raw document content; no training on uploads; export is renter-initiated download only.
- **Accessibility exclusion** → WCAG 2.2 AA target; keyboard-complete journey; icon+text statuses; tested with axe-core + keyboard runs.

## Known limitations (honest by design)
- One metro, one program (LIHTC), one rule year (2026); results do not generalize beyond the frozen corpus.
- Threshold values are placeholders until the official 2026 MTSP tables are loaded. <!-- remove this line in Phase 9 -->
- OCR quality bounds extraction on degraded scans; the system abstains rather than guesses.
- Checklist reflects the provided gold reference, not every property's individual requirements.
- The packet aids preparation; a qualified human reviewer makes all determinations.

## Residual risks & mitigations
- A renter might read the threshold comparison as a verdict → mitigation: disclaimer as body text at the point of comparison and on the packet cover; language avoids "eligible/qualify" everywhere.
- Confirmed-but-wrong values (renter confirms an incorrect number) → mitigation: evidence highlight shown at confirmation time; every value remains correctable; original model output preserved for audit.

## Licenses
<!-- Fill from the organizer license manifest in Phase 9: data (MTSP tables, synthetic docs), model (Claude API terms), code dependencies (MIT/Apache list via `npm ls` or license-checker). -->
- Data: TBD (organizer manifest)
- Model: Anthropic API — commercial terms
- Code: open-source dependencies, licenses to be enumerated (license-checker output)
