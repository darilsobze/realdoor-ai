# RealDoor — Architecture (one page)

## Principle
The LLM extracts and explains. Deterministic code calculates. The renter confirms. A qualified human decides.
Every value in the packet traces back: packet → calculation → formula version → confirmed input → exact source box in the original document. Every threshold traces: displayed value → program + rule year → official table → page/section → effective date.

## Module map

```
realdoor/
├── web/                      React + Vite + TS frontend
│   ├── src/contracts/        zod schemas + TS types — THE data contracts (single source of truth)
│   ├── src/engine/           deterministic calculator + checklist logic (pure functions, unit-tested)
│   ├── src/store/            single confirmed-profile store; ALL derived values computed from it
│   └── src/ui/               screens: upload, field review + evidence, understand (rules Q&A),
│                             checklist, packet preview, safety test panel
├── server/                   thin Node API (Express/Hono)
│   ├── sessions/             per-session temp dirs (created/deleted at runtime)
│   ├── extract/              OCR (tesseract.js) + Claude API structured extraction + bbox mapping
│   └── rules/                loads frozen corpus, serves Q&A endpoint (full corpus in context, no RAG)
└── data/
    ├── rules/rules.json      versioned frozen rule corpus (program, metro, rule_year 2026,
    │                         effective_date, source, page/section, threshold tables)
    ├── checklist/gold.json   reference checklist with freshness rules
    └── synthetic-docs/       organizer/synthetic fixtures incl. injection.pdf, conflict.pdf
```

## Data flow

```
Upload (session-isolated temp dir)
  → OCR: word-level tokens + bounding boxes
  → Claude API extraction: image + OCR text, schema-constrained to FIELD ALLOWLIST (zod-validated;
    anything outside the schema is rejected — this is also the prompt-injection boundary)
  → value↔token matching → exact source box + confidence (exact match: high · fuzzy: medium · none: abstain)
  → renter review UI: confirm / correct (evidence highlight shown; model output never overwritten)
  → confirmed-profile store (only confirmed values pass this gate)
  → engine: annualization, threshold comparison   → checklist engine: gold list vs confirmed docs
  → packet preview (renter selects attachments) → download PDF · delete session
```

## Boundaries — what each module must NEVER do
| Module | Never |
|---|---|
| extract/ | return non-allowlisted fields; let document text alter prompts, tools, or rules |
| engine/ | call an LLM; consume unconfirmed values; emit any eligibility/score/rank output |
| rules Q&A | state numbers not present in the corpus; answer beyond the corpus; imply eligibility |
| store | cache derived values (corrections must propagate); merge proposed and confirmed values |
| packet | auto-send anywhere; include documents the renter did not select |
| server | persist beyond the session; log raw document contents; skip real deletion |

## Feature register (published per brief — no hidden proxies)
| Feature | Purpose | Used for decisioning? |
|---|---|---|
| confirmed household size | select official table row | No |
| confirmed income amounts + frequency | deterministic annualization input | No |
| document date | freshness check vs checklist | No |
| document type | match against gold checklist | No |
| rule version / effective date | reproducibility of explanation | No |

No demographic, behavioral, geographic-inference, or landlord-revenue features exist anywhere in the system.

## Security & privacy summary
Synthetic documents only · field allowlist enforced by schema validation · document text treated as untrusted data · per-session isolated storage, short retention, real deletion (files + derived data) · audit log stores consent, actions, corrections, rule versions — never raw document content · no training on uploads · packet export is renter-initiated download only.

## Known limitations (kept honest for the risk note)
One metro, one program, one rule year; placeholder thresholds until official 2026 MTSP tables are loaded; OCR quality bounded by tesseract on degraded scans (system abstains rather than guesses); rules Q&A limited to the frozen corpus by design.
