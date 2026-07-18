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
| POST | `/rules/ask` | free-text rules question | body `{ question, confirmedContext? }`; returns `{ answer, citation: { program, rule_year, source, page, section, effective_date }, abstained: boolean }`; refuses eligibility requests with standard redirect |

## Audit
| Method | Route | Purpose | Notes |
|---|---|---|---|
| GET | `/session/:id/audit` | audit log | consent, uploads, corrections, rule version, export, deletion — never raw document content |

## Errors
JSON `{ error: { code, message, fieldRef? } }`. Codes: `SESSION_NOT_FOUND` (404), `VALIDATION_FAILED` (422, includes which allowlist rule rejected), `EXTRACTION_ABSTAINED` (200 with abstain status — not an error), `RULE_NOT_FOUND` (200 with `abstained: true`). Error messages must be understandable and, in the UI, programmatically linked to the relevant field (WCAG).

## Deliberately absent
No endpoint sends the packet anywhere. No endpoint returns an eligibility result. Packet generation happens client-side from confirmed data (or, if moved server-side later, remains download-only).
