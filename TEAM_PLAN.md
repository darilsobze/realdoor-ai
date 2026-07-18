# TEAM_PLAN.md — RealDoor, 3-person split (Daril · Hoan · Emmanuel)

> Commit this file to the repo root. The conflict-prevention rule is simple: **you only edit directories you own.** Cross-boundary changes go through the owner. Contracts are frozen (see below).

## Where the project stands
Done: contracts + design tokens + official 2026 data + fixtures (Phase 4), server with OCR→LLM extraction, sessions, real deletion (C2, on OpenAI), C3 review UI (commit df47921), and Hoan's extraction over-abstention fix (document-type classification path + split-date normalization, verified with 11 server tests and 7 proposed fields on `stub_clean.pdf`).
Next up: engine functions (Emmanuel) → C4 engine/propagation (Daril) → C5 checklist+packet → C6 rules Q&A → C7 safety panel → C8 accessibility → C9 metrics + demo.

## Roles and ownership

### Daril — Integration lead & frontend core (owns: `web/src/ui`, `web/src/store`, CLAUDE.md, TODO.md, MERGES)
The only person who merges to main and the only person who edits CLAUDE.md/TODO.md (others request changes via PR comment). Keeps the Claude Code session that has full history.
- C3: upload + field-review UI (evidence highlights, confirm/correct, version toast)
- C4: confirmedProfile store, propagation, "what will update" preview (uses Hoan's engine functions via the frozen contracts)
- Merge every PR same-day; resolve any conflict with the branch owner present
- Owns the GitHub repo settings and the demo machine

### Hoan — Backend, extraction & rules (owns: `server/`, `data/rules/`)
Runs their own Claude Code sessions scoped to server work ("work only inside server/ and data/rules/; read CLAUDE.md and docs/api.md first").
- DONE: fixed the over-abstention bug — document_type now has a classification path without requiring a token match, split-token dates normalize correctly, and regression coverage asserts ≥6 proposed fields on stub_clean. Verified with `npm test`, `npm run typecheck`, and `npm run prove` (7 proposed, 0 abstained).
- C6: /rules + /rules/ask endpoints — full frozen corpus in context, citations with effective date (or corpus freeze date when null), abstain out-of-corpus, eligibility refusal
- C7 server half: injection tests (document + filename), cross-session rejection test, audit-log hygiene, deletion proof endpoint behavior
- Runs extraction against the organizer's 24 gold docs and reports accuracy/abstention numbers to Emmanuel's metrics page

### Emmanuel — Product, checklist/packet & quality (owns: `web/src/engine`, checklist/packet UI routes, `docs/`, `data/checklist/`)
Runs their own Claude Code sessions scoped accordingly.
- C5: checklist engine vs gold.json (pure + tested; unconfirmed date → needs_confirmation, never expired) and the packet preview/download. Includes the queued decision: pick which organizer requirements demonstrate "Missing" and "Expired" with our fixtures, test it, update docs/demo-script.md
- C7 UI half: the Safety Test Panel page (wires to Hoan's endpoints)
- C8: accessibility pass — Playwright keyboard journey, axe-core, aria-live, zoom; plus one manual keyboard-only run
- C9: metrics page, risk-note finalization, demo-script verification; owns the pitch deck and the 6-minute rehearsal as demo lead
- Lovable prototype iteration for layout ideas (screenshots → to Daril, never code)

## The three shared surfaces (where conflicts would happen) and their rules
1. **`web/src/contracts/` is FROZEN.** Any schema change needs a 3-person OK in the group chat before the PR. This is the interface everyone builds against; silent changes here are how integration breaks.
2. **`docs/api.md` is the server contract.** Hoan updates it in the same PR as any endpoint change; Daril and Emmanuel build against the file, not against assumptions.
3. **CLAUDE.md / TODO.md**: Daril-only edits. Others put "TODO requests" in PR descriptions.

## Git workflow (simple on purpose)
- main is always runnable; nobody commits to main directly except Daril's merges.
- Branch per task, named `daril/c3-review-ui`, `hoan/fix-abstention`, `emmanuel/c5-checklist`, etc. Short-lived: open PR the same day, merge within 24h max — long-lived branches are the #1 conflict source.
- Rebase or merge main into your branch before opening the PR; you fix your own conflicts.
- Every PR: tests green + one-line "how I verified" (screenshot or command output).
- Push at every milestone; the remote is the backup.

## Dependency order (who blocks whom)
```
NOW (parallel):   Daril C3 UI      Hoan bug-fix → C6 rules     Emmanuel C5 engine+checklist (pure code, no UI deps)
THEN:             Daril C4 propagation  (needs: Hoan's bug fix merged + Emmanuel's engine functions)
THEN (parallel):  Emmanuel C5 packet UI + C7 panel    Hoan C7 server tests
THEN:             Emmanuel C8 accessibility (needs all screens to exist)
FINALLY:          C9 together — Emmanuel drives metrics/demo, Hoan supplies gold-set numbers, Daril fixes what rehearsal finds
```
The only hard sync point is C4: Hoan's fix and Emmanuel's engine functions must merge before Daril wires propagation. Target: both merged within the first working session.

## Claude Code for three people
Each person runs Claude Code in their own clone/branch. Start every session with: "Read CLAUDE.md, ARCHITECTURE.md, TODO.md and docs/api.md. You are working ONLY inside <owned directories> on branch <name>. Do not modify contracts, CLAUDE.md, or TODO.md." The ownership fence in the prompt is what keeps three agents from trampling each other.

## Session opening prompts

### Hoan — paste this to start every Claude Code session
> Read CLAUDE.md, ARCHITECTURE.md, TODO.md, and docs/api.md fully before doing anything. I am Hoan. You work ONLY inside `server/` and `data/rules/`, on my branch (prefix `hoan/`, e.g. `hoan/fix-abstention` — create it from latest main if it doesn't exist). Never modify `web/src/contracts/` (frozen), CLAUDE.md, or TODO.md; if an endpoint changes, update docs/api.md in the same PR. Never touch web/ or docs/ beyond api.md. The OpenAI key lives in server/.env only — never print it, never commit it. Start with my first task from the "Hoan" section of TODO.md: fix the extraction over-abstention bug (document_type classification path, multi-token date matching, regression test asserting ≥6 proposed fields on stub_clean.pdf). Plan first, keep the PR small, run `npm test` and `npm run prove` in server/ before declaring done, and end with a one-line "how I verified".

### Emmanuel — paste this to start every Claude Code session
> Read CLAUDE.md, ARCHITECTURE.md, TODO.md, and docs/api.md fully before doing anything. I am Emmanuel. You work ONLY inside `web/src/engine/`, the checklist/packet UI routes, `docs/`, and `data/checklist/`, on my branch (prefix `emmanuel/`, e.g. `emmanuel/c5-engine` — create it from latest main if it doesn't exist). Never modify `web/src/contracts/` (frozen), CLAUDE.md, TODO.md, or anything in server/, web/src/ui, web/src/store, web/src/pages. The engine is pure deterministic code: no LLM calls, no eligibility language, no scores; blocked results instead of guessing. Start with my first task from the "Emmanuel" section of TODO.md: the C5 engine functions (annualize, sumIncomeSources, compareToThreshold) with Vitest tests for every formula including blocked cases. Plan first, run `npm test` in web/ before declaring done, and end with a one-line "how I verified".

## Daily rhythm (hackathon-scaled)
Two 5-minute syncs per day: (1) what merged, (2) what's blocked, (3) any contract-change requests. Everything else async in the group chat with PR links.
