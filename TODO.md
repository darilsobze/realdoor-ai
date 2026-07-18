# TODO — build order (Claude Code: update this file as tasks complete; new sessions read this first)

Status legend: [ ] todo · [~] in progress · [x] done · [!] blocked

## Phase 0–2 · Setup
- [ ] Node 18+, Claude Code installed and logged in
- [ ] Vite React TS scaffold in web/, Tailwind, shadcn/ui, zod, react-pdf, pdf-lib
- [x] CLAUDE.md, ARCHITECTURE.md, docs/ in place; challenge context in realdoor-hackathon-starter-pack/ (README, rules/RULES_README.md, governance/)
- [ ] MCPs added: playwright, context7 (`claude mcp list` confirms)
- [ ] git init + first commit

## Phase 4 · Contracts & placeholder data
- [ ] zod schemas in web/src/contracts/ (ExtractedField, ConfirmedProfile, Rule, Calculation, ChecklistItem, Packet)
- [ ] data/rules/rules.json — placeholder thresholds, full citation metadata, PLACEHOLDER markers
- [ ] data/checklist/gold.json — 5 requirements incl. freshness rules
- [ ] Synthetic fixtures generated (see docs/demo-script.md fixture list, incl. injection.pdf)

## Phase 5 · Vertical slice  ← tag `vertical-slice` when done
- [ ] server: POST /session, upload, extract, DELETE /session (real deletion)
- [ ] OCR + schema-constrained Claude extraction + bbox mapping + confidence rule
- [ ] Field review UI with evidence highlights, confirm/correct
- [ ] engine/: annualize, sum, compare — pure + unit tests passing
- [ ] Single confirmed-profile store; downstream propagation verified (correct one field → everything updates)
- [ ] "What will update" preview before confirming a correction
- [ ] Calculations blocked on unconfirmed/unknown-frequency inputs, with plain-language explanation
- [ ] Checklist engine vs gold.json (statuses icon+text)
- [ ] Packet preview (renter-selected attachments) + PDF download, disclaimer included

## Phase 6 · Understand
- [ ] /rules + /rules/ask endpoints (full corpus in context, citation + effective date, abstain when uncovered)
- [ ] UI threshold numbers sourced from engine/rules.json, never from LLM text
- [ ] Eligibility-question refusal + redirect wired

## Phase 7 · Safety (20%)
- [ ] Safety test panel: refusal · injection.pdf · unconfirmed-reuse block · real deletion proof
- [ ] Consent notice at upload (what/why/retention/deletion)
- [ ] Audit log (no raw document content)

## Phase 8 · Accessibility (15%)
- [ ] Playwright keyboard-only full journey passes
- [ ] axe-core clean on all screens
- [ ] aria-live announcements; focus management in modals; 200% zoom check
- [ ] One manual keyboard-only run by a human

## Phase 9 · Evaluation & demo
- [ ] Swap in official organizer data (rules, gold fields, checklist) — remove PLACEHOLDER markers. NOTE: official frozen 2026 data is ALREADY in realdoor-hackathon-starter-pack/ (data/mtsp_2026_boston_cambridge_quincy.csv, rules/rule_corpus.jsonl, evaluation/application_checklists.json) — swap can happen any time after Phase 5
- [ ] Metrics page: field accuracy, source-box accuracy, abstention rate, test results
- [ ] docs/risk-note.md finalized (feature register, limitations, license manifest)
- [ ] Demo rehearsed twice per docs/demo-script.md; backup recording captured

## Cut line if behind (cut from the bottom up)
1. Keep: vertical slice → propagation → safety panel → citations → accessibility basics
2. Cut first: Discover (0 rubric points) → metrics dashboard → visual polish → multi-document support
