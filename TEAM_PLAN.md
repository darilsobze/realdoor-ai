# TEAM_PLAN.md — RealDoor (Daril · Hoan; Emmanuel departed 2026-07-19)

> Commit this file to the repo root. The conflict-prevention rule is simple: **you only edit directories you own.** Cross-boundary changes go through the owner. Contracts are frozen (see below).

## Where the project stands (updated 2026-07-19)
Done: Phase 4 (contracts, tokens, data, fixtures) → C2 backend → C3 review UI → C4 engine + propagation → C5 checklist + packet (tagged `vertical-slice`) → C6 rules Q&A + Understand screen → **C7 Safety Test Panel (5 live proofs)**. Vector-PDF rendering fix merged (organizer gold PDFs extract). The full demo journey (steps 1–6) works end to end. main at 081686b.
Next up: Hoan — C7 server tests + /rules/ask scope-default + 24-doc gold-set numbers. Daril — packet confirmed-values polish → **C8 accessibility** (all screens exist; app-wide focus ring fixed) → C9 (metrics + risk-note + demo rehearsal, as demo lead).
Known bug (logged in TODO): extraction over-abstains on clean stubs (document_type token-matched wrongly; date normalization too strict). Must be fixed before C4.

## Roles and ownership
> 2026-07-19: Emmanuel departed. Team is now 2 people — Daril (all frontend + product/docs/quality) and Hoan (backend). Daril absorbed Emmanuel's fences.

### Daril — Integration lead, frontend + product (owns: `web/src/ui`, `web/src/store`, `web/src/pages`, `web/src/components`, and — absorbed from Emmanuel — `web/src/engine`, checklist/packet UI, `docs/`, `data/checklist/`; plus CLAUDE.md, TODO.md, MERGES, demo)
The only person who merges to main and the only person who edits CLAUDE.md/TODO.md. Keeps the Claude Code session that has full history.
- C3 review UI, C4 propagation, C6 Understand screen, C7 consent notice + Safety Test Panel — DONE; also fixed the app-wide keyboard focus ring
- Absorbed from Emmanuel: packet confirmed-values polish → C8 accessibility → C9 (metrics page, risk-note, demo-script verification) as demo lead
- Merge every PR same-day; owns GitHub repo settings and the demo machine

### Hoan — Backend, extraction & rules (owns: `server/`, `data/rules/`)
Runs their own Claude Code sessions scoped to server work ("work only inside server/ and data/rules/; read CLAUDE.md and docs/api.md first").
- FIRST TASK (unblocks C4): fix the over-abstention bug — document_type gets a classification path (no token match), multi-token date matching, regression test asserting ≥6 proposed on stub_clean. Small PR, fast merge.
- C6: /rules + /rules/ask endpoints — full frozen corpus in context, citations with effective date (or corpus freeze date when null), abstain out-of-corpus, eligibility refusal
- C7 server half: injection tests (document + filename), cross-session rejection test, audit-log hygiene, deletion proof endpoint behavior
- Runs extraction against the organizer's 24 gold docs and reports accuracy/abstention numbers to Daril for the metrics page

### Emmanuel — DEPARTED 2026-07-19
Delivered and merged: C5 engine (annualize/sum/compare), C5 checklist engine, C5 packet builder + PDF. All remaining work (packet polish, C8 accessibility, C9 metrics/risk-note/demo) and all owned directories moved to Daril.

## The three shared surfaces (where conflicts would happen) and their rules
1. **`web/src/contracts/` is FROZEN.** Any schema change needs both Daril and Hoan to agree before the PR (was 3-person; now 2). This is the interface both sides build against; silent changes here are how integration breaks.
2. **`docs/api.md` is the server contract.** Hoan updates it in the same PR as any endpoint change; Daril builds against the file, not against assumptions.
3. **CLAUDE.md / TODO.md**: Daril-only edits. Hoan puts "TODO requests" in PR descriptions.

## Git workflow (simple on purpose)
- main is always runnable; nobody commits to main directly except Daril's merges.
- Branch per task, named `daril/c3-review-ui`, `hoan/fix-abstention`, `emmanuel/c5-checklist`, etc. Short-lived: open PR the same day, merge within 24h max — long-lived branches are the #1 conflict source.
- Rebase or merge main into your branch before opening the PR; you fix your own conflicts.
- Every PR: tests green + one-line "how I verified" (screenshot or command output).
- "Verified" in a PR means verified on the demo machine (Daril's) — OCR and extraction results differ per environment, and the demo machine is the one that counts.
- Push at every milestone; the remote is the backup.

## Dependency order (who blocks whom)
The original 3-person C1–C7 dependency chain is complete (see git history / TODO "Where we are"). Remaining work is a simple 2-person split with no hard cross-dependencies except: Hoan's 24-doc gold-set numbers feed Daril's C9 metrics page.

## Claude Code for two people
Each person runs Claude Code in their own clone/branch. Start every session with the ownership-fenced prompt below. The fence is what keeps the two agents from trampling each other.

## Session opening prompts

### Hoan — paste this to start every Claude Code session
> Read CLAUDE.md, ARCHITECTURE.md, TODO.md, and docs/api.md fully before doing anything. I am Hoan. You work ONLY inside `server/` and `data/rules/`, on my branch (prefix `hoan/`, created from latest main). Never modify `web/src/contracts/` (frozen — needs Daril's agreement), CLAUDE.md, or TODO.md; if an endpoint changes, update docs/api.md in the same PR. Never touch web/ or docs/ beyond api.md. The OpenAI key lives in server/.env only — never print it, never commit it. Start with my current tasks from the "Hoan" section of TODO.md (C7 server tests: injection via document + filename, cross-session rejection, audit hygiene, deletion proof; /rules/ask scope-default; 24-doc gold-set accuracy numbers for Daril's metrics page). Plan first, keep PRs small, run `npm test` and `npm run prove` in server/ before declaring done, and end with a one-line "how I verified".

### Daril — this session (integration lead, absorbed Emmanuel's fences)
> Own everything in web/ except `web/src/contracts` (frozen) plus `docs/` and `data/checklist/`; sole editor of CLAUDE.md/TODO.md and sole merger. Remaining: packet polish → C8 accessibility → C9 (metrics/risk-note/demo lead). Pull before each task, push after; review + merge Hoan's PRs on the demo machine.

## Daily rhythm (hackathon-scaled)
Two 5-minute syncs per day: (1) what merged, (2) what's blocked, (3) any contract-change requests. Everything else async in the group chat with PR links.
