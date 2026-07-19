# Frontend Backend Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `frontend/` the working RealDoor UI while preserving its routes and styling and connecting normal mode to the existing backend, official rules, deterministic calculations, gold checklist, PDF export, RAG statuses, and session deletion.

**Architecture:** TanStack routes continue to consume `SessionProvider`. React Query hooks call a focused API client, Zod 3 validates wire responses, and adapters convert those DTOs into stable frontend domain records. Safety mode stays fixture-backed; normal mode uses backend sessions and the ported pure engines.

**Tech Stack:** React 19, TanStack Start/Router/Query, TypeScript, Zod 3, Express API, Vitest, Tailwind CSS, pdf-lib.

---

### Task 1: API boundary and development proxy

**Files:**
- Create: `frontend/src/api/schemas.ts`
- Create: `frontend/src/api/errors.ts`
- Create: `frontend/src/api/client.ts`
- Create: `frontend/src/api/client.test.ts`
- Modify: `frontend/vite.config.ts`

- [ ] **Step 1: Write failing API client tests**

Test session creation, extraction validation, normalized server errors, rules responses, page URL generation, and deletion using a stubbed `globalThis.fetch`. Assert malformed payloads reject rather than reaching page code.

- [ ] **Step 2: Run the API tests and verify failure**

Run: `npm test -- src/api/client.test.ts`

Expected: FAIL because the API modules do not exist.

- [ ] **Step 3: Implement runtime schemas and errors**

Define strict Zod schemas for `{sessionId}`, `{documentId}`, extraction results,
the frozen rules file, rules-answer responses, and `{error:{code,message,fieldRef?}}`.
Implement `ApiError` with `code`, `status`, and optional `fieldRef`.

- [ ] **Step 4: Implement the API client**

Expose `createSession`, `uploadDocument`, `extractDocument`, `getRules`,
`askRules`, `getAudit`, `deleteSession`, and `pageUrl`. Use
`VITE_API_BASE_URL ?? "/api"`, URL-encode path identifiers, never auto-retry
mutations, and treat `SESSION_NOT_FOUND` during deletion as already deleted.

- [ ] **Step 5: Add the local proxy and run tests**

Configure `/api` to target `http://localhost:3001` and strip the prefix.

Run: `npm test -- src/api/client.test.ts`

Expected: PASS.

### Task 2: Canonical frontend domain and adapters

**Files:**
- Modify: `frontend/src/domain/types.ts`
- Create: `frontend/src/domain/field-meta.ts`
- Create: `frontend/src/api/adapters.ts`
- Create: `frontend/src/api/adapters.test.ts`
- Modify: `frontend/src/domain/fixtures.ts`
- Modify: `frontend/src/components/document-viewer.tsx`
- Modify: `frontend/src/components/field-row.tsx`

- [ ] **Step 1: Write failing adapter tests**

Use a backend extraction fixture containing a proposed money value, an
abstained field, document type, confidence tier, page number, and PDF-point
bbox. Assert all source data remains separate and document type maps to the UI
document kind without losing the canonical field name.

- [ ] **Step 2: Run adapter tests and verify failure**

Run: `npm test -- src/api/adapters.test.ts`

Expected: FAIL because canonical domain records and adapters are absent.

- [ ] **Step 3: Extend domain records**

Represent canonical backend field names, raw/model/normalized/corrected/
confirmed values, lifecycle state, confidence tier, abstention reason,
extraction version, one-based page number, and source coordinate space. Extend
documents with backend ID, page count, page URL builder, and synthetic flag.

- [ ] **Step 4: Implement extraction adapters and presentation metadata**

Map backend DTOs into UI records. Keep server field names canonical. Put labels,
formatting, and accepted correction input types in `field-meta.ts`.

- [ ] **Step 5: Adapt safety fixtures and evidence rendering**

Convert fixtures at their boundary to one-based normalized evidence. Update the
viewer to support fixture data URLs and backend page URLs, multi-page selection,
and both normalized and PDF-point boxes. Update field rows to show real
extractor/confidence wording and calm abstention states.

- [ ] **Step 6: Run adapter and domain tests**

Run: `npm test -- src/api/adapters.test.ts src/domain/*.test.ts`

Expected: PASS.

### Task 3: Session state and remote operation hooks

**Files:**
- Modify: `frontend/src/state/session.tsx`
- Create: `frontend/src/state/session.test.ts`
- Create: `frontend/src/api/hooks.ts`

- [ ] **Step 1: Write failing reducer tests**

Prove normal and demo state never mix, documents append within one backend
session, correction preserves the model proposal, profile version increments,
reset clears identifiers, and stale extraction results are ignored.

- [ ] **Step 2: Run state tests and verify failure**

Run: `npm test -- src/state/session.test.ts`

Expected: FAIL for the missing actions and state.

- [ ] **Step 3: Extend SessionProvider**

Add backend session ID, operation state, canonical fields, profile version,
change history, rules corpus, and active request generation. Preserve existing
consumer methods where their semantics remain correct.

- [ ] **Step 4: Implement React Query hooks**

Create hooks for create-and-upload, extraction, rules loading, rules Q&A,
audit reading, and deletion. Mutations dispatch domain actions only after
validated responses and use `AbortSignal` where supported.

- [ ] **Step 5: Run state and API tests**

Run: `npm test -- src/state/session.test.ts src/api/*.test.ts`

Expected: PASS.

### Task 4: Deterministic engine, official rules, and gold checklist

**Files:**
- Create: `frontend/src/engine/types.ts`
- Create: `frontend/src/engine/calculations.ts`
- Create: `frontend/src/engine/calculations.test.ts`
- Create: `frontend/src/engine/checklist.ts`
- Create: `frontend/src/engine/checklist.test.ts`
- Create: `frontend/src/domain/gold-checklist.ts`
- Replace: `frontend/src/domain/calc.ts`
- Replace: `frontend/src/domain/checklist.ts`

- [ ] **Step 1: Port failing deterministic-engine tests**

Cover weekly, biweekly, semimonthly, monthly, and annual multipliers; unknown
frequency blocking; unconfirmed input blocking; income summation; household-row
selection; neutral difference output; missing/expired/conflicting checklist
states; and checklist-version propagation.

- [ ] **Step 2: Run engine tests and verify failure**

Run: `npm test -- src/engine/*.test.ts`

Expected: FAIL because the engine modules do not exist.

- [ ] **Step 3: Port pure calculations**

Port the proven calculation behavior from `web/src/engine/calculations.ts` into
focused Zod-independent TypeScript. Emit typed computed or blocked records and
never emit eligibility labels.

- [ ] **Step 4: Port checklist evaluation**

Load `data/checklist/gold.json` without duplicating its contents. Evaluate
confirmed document metadata and household attestation with an explicit as-of
date. Block on unconfirmed dates and expose conflicts instead of choosing.

- [ ] **Step 5: Replace simulated domain calculation imports**

Make routes consume engine records. Leave safety-demo fixtures clearly marked
but run their confirmed data through the same engine interfaces.

- [ ] **Step 6: Run engine and existing frontend tests**

Run: `npm test -- src/engine/*.test.ts src/domain/*.test.ts`

Expected: PASS.

### Task 5: Real Profile upload and extraction progress

**Files:**
- Create: `frontend/src/components/extraction-progress.tsx`
- Modify: `frontend/src/routes/profile.tsx`
- Modify: `frontend/src/components/upload-dropzone.tsx`
- Modify: `frontend/src/routes/index.tsx`
- Modify: `frontend/src/routes/__root.tsx`

- [ ] **Step 1: Write failing Profile behavior tests**

Test that first upload creates a session, later uploads reuse it, extraction
completion adds fields, failure exposes retry, final progress does not complete
early, and successful extraction announces/focuses review.

- [ ] **Step 2: Run the Profile tests and verify failure**

Run: `npm test -- src/routes/profile.test.tsx`

Expected: FAIL because Profile still uses local placeholder documents.

- [ ] **Step 3: Port the staged progress component**

Use pending/active/done/error states with text and icons. Cap timed stages so
the allowlist stage completes only after a validated extraction response.

- [ ] **Step 4: Replace local upload behavior**

Remove `fileToDocument()` and its fake timer. Call the session/upload/extraction
hooks, adapt results, preserve the current page layout, and expose manual retry.

- [ ] **Step 5: Correct privacy and mode copy**

Normal mode discloses server and configured provider processing. Demo mode
continues to state that it uses local synthetic fixtures. Remove claims that a
normal-mode file never leaves the browser or server.

- [ ] **Step 6: Run Profile tests**

Run: `npm test -- src/routes/profile.test.tsx src/api/*.test.ts`

Expected: PASS.

### Task 6: Understand page and computation traces

**Files:**
- Create: `frontend/src/components/computation-trace.tsx`
- Create: `frontend/src/components/trace-cards.tsx`
- Create: `frontend/src/lib/motion.ts`
- Modify: `frontend/src/routes/understand.tsx`
- Modify: `frontend/src/components/citation-card.tsx`
- Modify: `frontend/src/components/rule-graph.tsx`

- [ ] **Step 1: Write failing Understand tests**

Test official rule loading, trusted citation rendering, refusal, abstention,
blocked math, computed math, neutral above/below wording, and replay behavior.

- [ ] **Step 2: Run Understand tests and verify failure**

Run: `npm test -- src/routes/understand.test.tsx`

Expected: FAIL while the route still imports simulated rules.

- [ ] **Step 3: Port computation traces**

Use real calculation inputs/formulas/citations for every visible step. Respect
reduced motion and announce completion once.

- [ ] **Step 4: Connect official rules and Q&A**

Load `GET /rules`, select the official 60% 2026 MTSP table, post questions to
`/rules/ask`, and render only trusted citations returned by the server.

- [ ] **Step 5: Run Understand and engine tests**

Run: `npm test -- src/routes/understand.test.tsx src/engine/*.test.ts`

Expected: PASS.

### Task 7: Prepare page and PDF packet

**Files:**
- Create: `frontend/src/engine/packet.ts`
- Create: `frontend/src/engine/packet-pdf.ts`
- Create: `frontend/src/engine/packet.test.ts`
- Modify: `frontend/src/routes/prepare.tsx`
- Modify: `frontend/package.json`

- [ ] **Step 1: Write failing packet tests**

Prove only confirmed values and selected attachments enter the packet, preview
and PDF share content, rule/checklist/formula versions are present, no verdict
is emitted, and a PDF can be loaded with `pdf-lib`.

- [ ] **Step 2: Run packet tests and verify failure**

Run: `npm test -- src/engine/packet.test.ts`

Expected: FAIL because PDF packet modules do not exist.

- [ ] **Step 3: Port packet assembly and renderer**

Port the proven pure packet assembly and PDF rendering behavior. Add `pdf-lib`
to the new frontend dependencies and keep attachments excluded by default.

- [ ] **Step 4: Connect Prepare to the gold checklist and PDF**

Replace the simulated checklist and text download. Keep the page layout,
attachment controls, renter notes, preview, and RAG badges.

- [ ] **Step 5: Run packet and checklist tests**

Run: `npm test -- src/engine/packet.test.ts src/engine/checklist.test.ts`

Expected: PASS.

### Task 8: Session deletion, safety mode, and normalized errors

**Files:**
- Modify: `frontend/src/routes/__root.tsx`
- Modify: `frontend/src/routes/safety.profile.tsx`
- Modify: `frontend/src/components/banner.tsx`
- Create: `frontend/src/api/integration.test.ts`

- [ ] **Step 1: Write failing lifecycle tests**

Test backend deletion before local reset, already-deleted handling, retained
state on failed deletion, demo-only local deletion, mode isolation, 422 field
errors, and 503 manual retry messaging.

- [ ] **Step 2: Run lifecycle tests and verify failure**

Run: `npm test -- src/api/integration.test.ts`

Expected: FAIL for missing lifecycle behavior.

- [ ] **Step 3: Implement deletion and error presentation**

Call backend deletion in normal mode, clear locally only after `204` or
`SESSION_NOT_FOUND`, focus associated errors, ignore stale responses, and keep
demo reset local.

- [ ] **Step 4: Keep safety fixtures isolated**

Ensure demo documents use adapted UI records and never populate normal session
IDs, official-rule state, or normal packets.

- [ ] **Step 5: Run lifecycle and safety tests**

Run: `npm test -- src/api/integration.test.ts src/domain/safety.test.ts`

Expected: PASS.

### Task 9: Full verification and handoff

**Files:**
- Modify: `docs/api.md` only if the implementation changes an endpoint
- Modify: `docs/risk-note.md` for corrected processing disclosure

- [ ] **Step 1: Run all new frontend checks**

Run: `npm test`

Run: `npm run lint`

Run: `npm run build`

Expected: every command exits 0.

- [ ] **Step 2: Run backend and legacy regression checks**

Run from `server/`: `npm test && npm run typecheck`

Run from `web/`: `npm test && npm run build`

Expected: every command exits 0.

- [ ] **Step 3: Run accessibility and acceptance checks**

Start the backend and new frontend, then run keyboard-only navigation, axe,
reflow, reduced-motion, upload/evidence/correction/math/rules/checklist/PDF,
refusal, prompt-injection, and session-deletion journeys. Record any check that
cannot run because an external provider is unavailable instead of claiming it
passed.

- [ ] **Step 4: Review the challenge brief line by line**

Confirm Profile, Understand, Prepare, six acceptance-demo actions, five
non-negotiable control groups, and architecture/risk deliverables have current
evidence. Report remaining backend audit/retention gaps separately.

- [ ] **Step 5: Commit the integrated frontend**

Stage only the implementation, tests, lockfile, and relevant documentation.
Do not stage `docs/03.pdf`. Verify the staged diff and commit without amending
or rewriting Lovable history.
