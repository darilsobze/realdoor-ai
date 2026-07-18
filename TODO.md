# TODO — grouped by owner (see TEAM_PLAN.md for roles + dependency map; Claude Code: update as tasks complete)

Status legend: [ ] todo · [~] in progress · [x] done · [!] blocked
Fences: work only in your owned directories · contracts frozen · only Daril edits this file (others: "TODO request" in the PR description).

## Dependency snapshot (from TEAM_PLAN.md)
```
NOW (parallel):   Hoan bug-fix → C6 rules     Emmanuel C5 engine+checklist (pure code)
THEN:             Daril C4 propagation  (needs: Hoan's bug fix + Emmanuel's engine functions merged)
THEN (parallel):  Emmanuel C5 packet UI + C7 panel    Hoan C7 server tests
THEN:             Emmanuel C8 accessibility (needs all screens)
FINALLY:          C9 together
```

## Hoan — server/ + data/rules/  (branch prefix `hoan/`)
- [ ] FIRST TASK (unblocks Daril's C4) — fix extraction over-abstention on clean stubs: document_type gets a classification path (no token match), multi-token date matching (date normalization currently too strict), regression test asserting ≥6 proposed fields on stub_clean.pdf. Small PR, fast merge.
- [ ] C6: /rules + /rules/ask endpoints — full frozen corpus in context (OpenAI, same provider seam + OPENAI_API_KEY as extraction), answer only from corpus, citation + effective date (corpus freeze date when effective_date is null), abstain when uncovered, eligibility-question refusal + redirect. Update docs/api.md in the same PR.
- [ ] C7 (server half): injection tests (document text AND filename), cross-session ID rejection test, audit-log hygiene (no raw document content), deletion-proof endpoint behavior (delete → re-fetch → 404).
- [ ] C9 input: run extraction against the organizer's 24 gold docs; report field accuracy / source-box accuracy / abstention numbers to Emmanuel for the metrics page.

## Emmanuel — web/src/engine + checklist/packet + docs/ + data/checklist/  (branch prefix `emmanuel/`)
- [ ] C5 engine (pure, unblocks Daril's C4): annualize(amount, frequency), sumIncomeSources, compareToThreshold(rule, householdSize) in web/src/engine/ — pure functions returning full Calculation records (formula string, rounding, inputs, rule id), typed `blocked` results for unconfirmed/unknown-frequency inputs, Vitest for every formula incl. blocked cases. No LLM, no UI deps.
- [ ] C5 checklist engine vs data/checklist/gold.json — pure + tested; statuses icon+text; unconfirmed document date → needs_confirmation, never expired. Includes the queued decision: pick which organizer requirements demonstrate "Missing" and "Expired" with our fixtures, test it, update docs/demo-script.md.
- [ ] C5 packet: preview route (cover + disclaimer as body text, confirmed values with evidence references, calculation sheet with formula + citation + effective date, checklist, unresolved items, manifest), renter-selected attachments, pdf-lib download. Parity bar: same sections, values, order, and manifest as the preview.
- [ ] C7 (UI half): Safety Test Panel page running live against Hoan's endpoints (refusal · injection.pdf · unconfirmed-reuse block · deletion proof · cross-session rejection).
- [ ] C8 accessibility: Playwright keyboard-only full journey, axe-core clean on all screens, aria-live announcements, focus management in modals, 200% zoom check, one manual keyboard-only run.
- [ ] C9: metrics page (field accuracy, source-box accuracy, abstention rate, test pass counts vs gold — numbers from Hoan), docs/risk-note.md finalized (feature register, limitations, license manifest), demo-script verified end to end via Playwright; reconcile demo-script.md fixture/requirement references (it still names dropped placeholder requirements photo_id / address_verification). Demo lead: pitch deck + 6-minute rehearsal ×2 + backup recording.

## Daril — web/src/ui + store + pages + components, CLAUDE.md/TODO.md, merges  (branch prefix `daril/`)
- [ ] C4 (after Hoan's fix + Emmanuel's engine merge): single confirmedProfile store — all derived values (annualization, comparison, checklist, packet preview) computed from it, no cached copies; profileVersion + change log already in place; replace static FIELD_DEPENDENTS map (web/src/lib/field-meta.ts) with the real engine recompute list; blocked calculations rendered as calm info panels with plain-language reasons. Demonstrate propagation: correct gross_pay → screenshot updated annualization, comparison, checklist, packet preview.
- [ ] C6 UI: "Understand" panel — question box wired to Hoan's /rules/ask; threshold numbers shown in the UI come from engine/rules.json, never from LLM text; refusals/abstentions styled as info panels.
- [ ] C7: consent notice at upload (what is read / why / retention / deletion).
- [ ] Merges: every PR same-day; tag `vertical-slice` when Phase 5 completes; keep main runnable.

## Done (compressed history — see git log for detail)
- [x] Phase 0–2: scaffold (Vite/React/TS, Tailwind v4, shadcn radix, zod, react-pdf, pdf-lib, vitest, playwright), design tokens + style guide, MCPs, git init
- [x] Phase 4 (C1): strict zod contracts + field state machine (35 tests), placeholder rules/checklist data, 7 synthetic fixtures with OCR-verified degradation
- [x] C2: session service (create/upload/extract/page-render/audit/real DELETE, 8 integration tests), OCR + schema-constrained extraction on OpenAI gpt-5-mini behind provider seam, bbox matching + confidence rule, live proof on stub_clean (`cd server && npm run prove`)
- [x] Official frozen 2026 data swapped in early (rules.json = frozen corpus + FY2026 MTSP 50%/60% tables; gold.json = organizer checklist; manifest = 24 organizer PDFs + injection + conflict)
- [x] C3: upload + field-review UI (evidence highlights, confirm/correct with what-will-update preview + version toast, uncertainty center, keyboard path verified, 1280/380 screenshots reviewed)
