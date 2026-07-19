# API Contract — web ↔ server

> Response/request shapes reference the zod schemas in `web/src/contracts/` — do not restate shapes here; link them. Update this file in the same commit as any endpoint change. If this file and the code disagree, the code is truth and this file is a bug.

Base URL (dev): `http://localhost:3001`

## Session lifecycle
| Method | Route | Purpose | Notes |
|---|---|---|---|
| POST | `/session` | create session | returns `{ sessionId }`; creates isolated temp dir |
| DELETE | `/session/:id` | delete session | removes ALL files + derived data; subsequent calls → 404 |

## Documents & extraction
| Method | Route | Purpose | Notes |
|---|---|---|---|
| POST | `/session/:id/documents` | upload one PDF | multipart; stored only in session dir; returns `{ documentId, documentType? }` |
| POST | `/session/:id/documents/:docId/extract` | run OCR + extraction | returns `ExtractedField[]` (contracts) — allowlist-validated, with bbox, confidence, status; abstained fields have status `unable_to_extract` |
| GET | `/session/:id/documents/:docId/page/:n` | page image for evidence view | PNG render for react-pdf overlay alignment |

## Rules
| Method | Route | Purpose | Notes |
|---|---|---|---|
| GET | `/rules` | frozen corpus metadata + threshold tables | serves `data/rules/rules.json`; UI thresholds come from HERE via the engine, never from LLM text |
| POST | `/rules/ask` | free-text rules question | body `{ question, confirmedContext?: { program_id?, metro_id?, rule_year? } }`; returns the rules-answer shape below |

`POST /rules/ask` returns:

```ts
{
  answer: string;
  citation: null | {
    rule_id: string;
    authority: "official_hud" | "official_federal" | "hackathon_simulation";
    program_id: string;
    metro_id: string;
    rule_year: number;
    rule_version: string;
    effective_date: string; // corpus frozen_at when the source has no date
    official_source: string;
    page: number | string | null;
    section: string | null;
    table_id: string | null;
  };
  abstained: boolean;
  refusal: boolean;
}
```

Direct and indirect decision requests (including eligibility, approval,
acceptance, denial, probability, and “my chances”) are refused
deterministically before any model call. Other questions pass the complete
frozen corpus to OpenAI. Model output is constrained by strict JSON Schema,
validated by zod, retried exactly once after invalid output, then abstained.
The model selects a rule ID; the server reconstructs citations only from the
trusted local corpus. A requested program, metro, or year that does not match
the selected rule returns an abstention with no citation.

## Audit
| Method | Route | Purpose | Notes |
|---|---|---|---|
| GET | `/session/:id/audit` | audit log | consent, uploads, corrections, rule version, export, deletion — never raw document content |

## Errors
JSON `{ error: { code, message, fieldRef? } }`. Codes: `SESSION_NOT_FOUND` (404), `DOCUMENT_NOT_FOUND` (404 — includes a valid docId presented against the wrong session), `PAGE_NOT_FOUND` (404), `VALIDATION_FAILED` (422, `fieldRef` names the offending field), `EXTRACTION_UNAVAILABLE` (503 — server has no API key configured), `RULES_UNAVAILABLE` (503 — rules Q&A has no API key configured), `RULE_NOT_FOUND` (200 with `abstained: true`), `INTERNAL` (500 — generic; server errors never echo prompt or document contents). Extraction abstention is NOT an error: 200 with an empty/abstained `fields` array. Rules abstention is also not an error: 200 with `abstained: true` and `citation: null`. Error messages must be understandable and, in the UI, programmatically linked to the relevant field (WCAG).

## Deliberately absent
No endpoint sends the packet anywhere. No endpoint returns an eligibility result. Packet generation happens client-side from confirmed data (or, if moved server-side later, remains download-only).
