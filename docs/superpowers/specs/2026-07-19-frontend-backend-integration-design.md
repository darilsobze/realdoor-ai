# Frontend to Backend Integration Design

Date: 2026-07-19

## Objective

Integrate the TanStack application in `frontend/` with the existing RealDoor
Express backend while preserving the new frontend's visual design, homepage,
route structure, safety-demo journey, and Red-Amber-Green status experience.
The integration must retain the existing challenge controls: allowlisted
extraction, evidence boxes, explicit confirmation and correction, deterministic
math, frozen cited rules, gold-checklist evaluation, renter-controlled export,
refusal behavior, and real session deletion.

## Selected Approach

Use `frontend/` as the complete product UI and place a typed adapter between its
domain state and the existing backend. Components and routes consume frontend
domain models only; they never consume backend DTOs directly.

```text
TanStack routes and components
          |
SessionProvider and React Query hooks
          |
API schemas, adapters, and normalized errors
          |
Existing Express API
```

The existing `web/` application remains intact as a working reference until the
new journey passes the complete acceptance suite. It is not embedded in the new
frontend and its UI state is not shared at runtime.

## Scope

### Included

- Preserve the `frontend/` homepage and routes `/`, `/profile`,
  `/safety/profile`, `/understand`, and `/prepare`.
- Connect normal mode to the real session, document, extraction, page-image,
  rule, rules-question, audit-read, and deletion endpoints.
- Keep safety-demo mode fixture-driven and isolated from normal sessions.
- Preserve the new frontend's layouts, controls, state pages, design tokens,
  status pills, and accessibility behavior.
- Port the existing staged extraction progress and deterministic computation
  trace behavior into the new visual system.
- Use the official frozen 2026 rule corpus and supplied gold checklist.
- Use confirmed values only for calculations, checklist evaluation, and packet
  content.
- Generate the existing renter-controlled PDF packet rather than the prototype
  text export.
- Correct privacy copy so it accurately describes server and model processing.

### Not included

- Rebuilding the Express backend or changing its extraction provider.
- Adding eligibility, approval, scoring, ranking, or acceptance predictions.
- Redesigning the new frontend.
- Removing `web/` before acceptance verification succeeds.
- Combining normal-mode data with safety-demo fixtures.
- Adding property discovery.

## Application Modes

### Normal mode

Normal mode uses the Express backend. A session is created lazily on the first
upload and reused for subsequent uploads until the renter deletes or resets it.
Documents, extracted fields, page evidence, and backend identifiers remain
scoped to that session.

### Safety-demo mode

`/safety/profile` continues to use curated synthetic fixtures. It demonstrates
correction, prompt-injection handling, expired documents, and status behavior
without requiring a configured model provider. Entering demo mode clears normal
client state; returning to normal mode clears demo state. The two modes never
share documents or confirmed values.

## API Boundary

All backend-specific code lives under `frontend/src/api/`:

```text
frontend/src/api/
  client.ts       Fetch wrapper, base URL, request construction
  schemas.ts      Zod 3 runtime validation of backend responses
  adapters.ts     Backend DTO to frontend domain conversion
  hooks.ts        React Query queries and mutations
  errors.ts       Normalized error types and UI-safe messages
```

The adapter boundary deliberately does not import `web/src/contracts`. The old
application uses Zod 4 while the new frontend uses Zod 3, and direct imports
would couple the new build to the legacy UI package. `schemas.ts` validates the
wire contract independently. Contract tests use the Express application to
detect drift between these schemas and real responses.

The client uses one configurable base URL. Local development uses a same-origin
`/api` proxy to `http://localhost:3001`; deployed environments may provide a
different public base URL. No secret is placed in a browser environment
variable.

### Current endpoints

- `POST /session`
- `DELETE /session/:id`
- `POST /session/:id/documents`
- `POST /session/:id/documents/:documentId/extract`
- `GET /session/:id/documents/:documentId/page/:page`
- `GET /rules`
- `POST /rules/ask`
- `GET /session/:id/audit`

Backend response changes are absorbed by `schemas.ts` and `adapters.ts`.
Components remain stable as long as the frontend domain model does not change.

## Frontend Domain Model

The frontend uses backend canonical field names in normal mode instead of
converting them into the prototype's simulated names. Presentation metadata
maps canonical names to renter-friendly labels and formatting. This avoids
lossy combinations such as merging `pay_period_start` and `pay_period_end` into
one field.

Each UI field keeps:

- Backend field and document identifiers.
- Canonical field name.
- Raw model proposal and normalized proposal as separate values.
- User correction and confirmed value as separate values.
- Confidence and confidence tier.
- Lifecycle state and abstention reason.
- Page number and source box in PDF points.
- Extraction version.

Safety fixtures are adapted into this same view model at the fixture boundary.
Normal backend data is not marked synthetic by the adapter; the surrounding
normal-mode copy states that the challenge accepts synthetic uploads only.

The document viewer accepts page URLs and PDF-point evidence boxes. It derives
the rendered overlay scale from the loaded page image, following the proven
viewer behavior in `web/`. This preserves evidence alignment without inventing
page dimensions in the adapter.

## State Ownership

`SessionProvider` remains the UI-facing store. Its existing actions and hooks
are retained where practical, then extended with:

- Backend session ID.
- Per-document backend ID and display metadata.
- Operation state for session creation, upload, extraction, rule loading,
  export, and deletion.
- Canonical extracted-field records.
- Confirmed profile version and change history.
- Loaded frozen rule corpus and checklist version.

React Query owns remote operation state and response caching. `SessionProvider`
owns renter edits, confirmations, selected evidence, household size, and the
derived profile version. Raw server responses never enter components.

Confirming or correcting a field produces a new confirmed profile revision.
Every deterministic output is recomputed from that revision; derived values are
not stored as a second source of truth.

## Upload and Extraction Flow

The normal `/profile` flow is:

1. Validate file type and size in the existing dropzone.
2. Create a backend session if none exists.
3. Upload the file to that session.
4. Request extraction for the returned document ID.
5. Validate and adapt the extraction response.
6. Add the document and fields to `SessionProvider`.
7. Navigate or focus the renter on the review area.

The visible stages are:

1. Uploading the document.
2. Rendering pages.
3. Reading text with OCR.
4. Identifying allowlisted values.
5. Matching values to page evidence.
6. Validating the allowlist response.

Intermediate stages may advance only as honest progress indicators and remain
capped before completion. The final stage becomes complete only after a valid
backend extraction response. An error marks the current stage failed and offers
a manual retry. Upload and extraction do not retry automatically because an
automatic retry could create duplicate documents.

## Red-Amber-Green Status Semantics

Color is always secondary to text and an icon.

- Green means an operation completed, a field was renter-confirmed, or a
  deterministic calculation completed.
- Amber means renter review is required, an input is missing or unconfirmed,
  confidence requires attention, or a calculation is correctly blocked.
- Red means an actual request or validation error, a confirmed conflict, a
  rejected value, or an expired required document.
- Blue or neutral informational styling is used for active processing,
  abstention, citations, and explanatory notices where Red-Amber-Green would
  incorrectly imply success or failure.

An income amount being above, equal to, or below a published threshold is
neutral factual text. It is never colored as an eligibility verdict.

## Deterministic Calculations

The existing pure calculation behavior and tests are ported into
`frontend/src/engine/` rather than reimplemented with the prototype's hard-coded
biweekly formula. The engine:

- Accepts confirmed amounts and explicit confirmed frequencies only.
- Uses the frozen challenge annualization multipliers.
- Sums independently documented recurring income sources.
- Selects the official threshold row from confirmed household size.
- Emits either a versioned computed record or a typed blocked record.
- Never calls an LLM and never emits an eligibility verdict.

The computation trace is a replay over already-computed records. Its labels,
inputs, formulas, rule references, and result are read from those records. The
animation never delays or gates the actual calculation and respects
`prefers-reduced-motion`.

When multiple confirmed documents supply conflicting values for the same
calculation input, the calculation is blocked and the relevant status becomes
conflicting. The adapter or engine never silently chooses one value.

## Route Behavior

### `/`

Keep the existing homepage structure, artwork, mode selection, and navigation.
Update only statements that claim files stay exclusively in the browser. The
normal-mode disclosure must state that synthetic documents are sent to the
RealDoor server and configured extraction provider for this session, are not
used for eligibility decisions, and can be deleted. Demo-mode copy continues to
describe local fixture behavior.

### `/profile`

Keep the current layout, dropzone, household-size control, document selector,
field rows, correction controls, evidence selection, unresolved summary, and
RAG styling. Replace `fileToDocument()` and its timer with the real mutation
flow. The viewer loads backend page images and renders exact evidence boxes.

### `/safety/profile`

Keep the current fixture selection and demo state. Adapt fixtures through the
same UI model so field rows and status components behave consistently.

### `/understand`

Replace simulated program configuration with `GET /rules`. Send free-text
questions to `POST /rules/ask`. Render only server-trusted citations and
structured thresholds. Use deterministic calculation records for the income
and comparison traces. Refusal and abstention remain correct, calm outcomes.

### `/prepare`

Evaluate the existing frozen `data/checklist/gold.json` through the ported pure
checklist engine. Keep the new page layout, attachment selection, renter notes,
and preview. Port the existing packet assembly and PDF renderer so preview and
download use the same versioned content. Documents are excluded unless the
renter explicitly selects them, and no route sends a packet externally.

### Global deletion

Normal mode calls the backend deletion endpoint before clearing client state.
A successful `204` clears all local state and returns to the homepage. A
`SESSION_NOT_FOUND` response is treated as already deleted and also clears local
state. Other failures leave local identifiers available for retry and clearly
state that server deletion was not confirmed. Demo mode clears local state
only.

## Rules and Checklist Sources

Normal mode never imports the simulated `frontend/src/domain/program-config.ts`
rules. Rules come from the backend's frozen corpus. The gold checklist is loaded
from the repository's existing frozen JSON through a small build-time loader;
its contents are not duplicated. Both versions appear in calculation, checklist,
and packet records.

The safety demo may retain clearly labeled simulated records, but those records
never enter normal-mode calculations or packets.

## Error Handling

All failures become a normalized `ApiError` containing a stable code, safe
message, optional field reference, and HTTP status. Components do not inspect
arbitrary JSON.

- `SESSION_NOT_FOUND`: clear the stale session and return to Profile, except
  during deletion where it counts as already deleted.
- `DOCUMENT_NOT_FOUND` and `PAGE_NOT_FOUND`: keep the session, mark the affected
  document unavailable, and offer navigation back to its document list.
- `VALIDATION_FAILED`: associate the message with the upload or referenced
  field and move focus to the error.
- `EXTRACTION_UNAVAILABLE` and `RULES_UNAVAILABLE`: show a service-unavailable
  state and a manual retry without fabricating fixture results.
- Unknown server errors: show a generic retry message and never render raw
  payloads, prompts, document contents, or stack traces.

In-flight requests use cancellation when a route unmounts or a session is
deleted. A late response for an obsolete session is ignored.

## Accessibility

- Status is always icon plus text; color is never the sole signal.
- Extraction progress and completed calculations use live-region
  announcements without repeatedly interrupting screen-reader users.
- Focus moves to the review heading after successful extraction and to the
  relevant error after a failed operation.
- All actions remain keyboard reachable.
- Computation animations respect reduced-motion preferences.
- Evidence selection exposes the page and source label to assistive technology.
- Existing structured headings, labels, and completion announcements remain.

## Verification

### Unit and contract tests

- Validate every current backend response schema.
- Test canonical field, confidence, abstention, and source-box adaptation.
- Test normalized errors for every documented error code.
- Test Red-Amber-Green semantic mappings.
- Prove unconfirmed and conflicting values cannot enter calculations.
- Port and retain deterministic calculation, checklist, packet, refusal, and
  field-state tests.
- Run adapter contract tests against the Express application so backend drift
  fails visibly.

### Route integration tests

- Normal and demo modes remain isolated.
- First upload creates a session; later uploads reuse it.
- Extraction progress completes only after a valid response.
- Evidence selection loads the correct page and box.
- Confirmation and correction produce new profile revisions.
- Rules Q&A renders trusted citations, refusals, and abstentions.
- Packet preview and generated PDF contain matching content.
- Backend deletion clears normal state; demo deletion stays local.

### Acceptance journey

```text
Homepage
  -> upload synthetic document
  -> observe extraction progress
  -> inspect evidence
  -> correct and confirm a value
  -> observe recomputed deterministic trace
  -> ask a rules question and inspect its citation
  -> inspect missing or expired checklist items
  -> preview and download the PDF packet
  -> run refusal and injection checks
  -> delete the session and prove it is unavailable
```

The final gate includes frontend unit tests, server tests, production builds,
keyboard-only navigation, axe scanning, reduced-motion behavior, the full
model-backed acceptance journey, and confirmation that no challenge control
regressed. `web/` is retained until this gate passes.

## Compatibility with Future Backend Changes

The pages depend on stable frontend domain models, not endpoint payloads. A
backend change is handled in this order:

1. Update the runtime wire schema.
2. Update the adapter into the stable frontend domain model.
3. Update contract fixtures and server-backed contract tests.
4. Change page components only if the product behavior itself changed.

This boundary permits endpoint versioning, optional new metadata, or a new
backend provider without redesigning the route components or status system.

## Known Follow-up Compliance Work

The integration preserves existing backend behavior but does not by itself add
write endpoints for consent, corrections, rule-version usage, or packet-export
audit events. The existing audit model defines those events but the current API
does not accept them from the client. A minimal authenticated or session-scoped
audit-write design must be completed before claiming that every required action
is recorded. Session retention, startup cleanup, and encryption-at-rest policy
also remain backend responsibilities and must be verified before the final
challenge demonstration.
