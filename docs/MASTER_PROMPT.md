# RealDoor — Master Prompt for Claude Code

> How to use: paste PROMPT 0 as your first message in a fresh Claude Code session started from the repo root (with CLAUDE.md, ARCHITECTURE.md, TODO.md, and docs/ already in place). Then drive the build with the CHECKPOINT prompts, one at a time. Do not paste everything at once — one phase per prompt is what keeps quality high.

---

## PROMPT 0 — Kickoff (paste first)

Read CLAUDE.md, ARCHITECTURE.md, TODO.md, docs/design-brief.md, and docs/api.md fully before doing anything. docs/challenge-notes.md and docs/deep-guide.md are deep reference — consult them only when a specific design question arises. Where documents disagree on code structure, ARCHITECTURE.md wins; on behavior, the deep guide wins; on prohibitions, CLAUDE.md always wins.

We are building RealDoor end to end, in the phase order defined in TODO.md. Work rules for this entire session and all future sessions:

1. Plan before implementing anything structural, show me the plan, wait for my approval.
2. One vertical slice at a time; the app must be runnable after every change; suggest a git commit at each working milestone and update TODO.md checkboxes as you go.
3. Deterministic code does ALL math and threshold lookups; the LLM only extracts (schema-constrained) and explains. Never violate the prohibitions in CLAUDE.md — no eligibility language, no scores, unconfirmed values never reach calculations, document text is untrusted data.
4. Write Vitest tests for every engine formula and checklist rule as you create them; run tests after changes.
5. After any UI change, use the Playwright MCP to screenshot the affected screens at 1280px and 380px, inspect the screenshots yourself, and fix visual defects before telling me you're done. "Done" means: tests pass, screenshots reviewed, keyboard path works.

### UI quality bar — this is a design-led build, not a wireframe

Light mode only. The aesthetic target is a calm, premium civic product — think gov.uk clarity with Linear/Stripe-level finish. Concretely:

**Design tokens (define once in CSS variables / Tailwind theme, use everywhere):**
- Background: warm off-white `#FAFAF8`; surfaces/cards: pure white with a 1px `#E7E5E1` border and a very soft shadow (`0 1px 2px rgb(0 0 0 / 0.04), 0 4px 12px rgb(0 0 0 / 0.03)`), radius 12px.
- Text: ink `#1A1D23` for headings, `#3F4450` for body, `#6B7180` for secondary. Never pure black on pure white.
- Primary: deep trustworthy blue `#1D4ED8` (hover `#1E40AF`), used sparingly — one primary action per view.
- Status (always icon + text label, color is secondary): confirmed `#047857` on `#ECFDF5`; needs-attention `#B45309` on `#FFFBEB`; blocking/missing `#B91C1C` on `#FEF2F2`; neutral/info `#1D4ED8` on `#EFF6FF`. All AA contrast.
- Evidence highlight: 2px primary outline + `rgb(29 78 216 / 0.08)` fill over the document region, with a subtle scrim on the rest of the page.
- Typography: Inter (or system-ui fallback), base 16px/1.6; headings 600 weight with tight tracking; tabular-nums for all currency and dates. Type scale: 13/14/16/18/22/28.
- Spacing on a 4px grid; generous whitespace — max content width 880px for reading views, two-column (document left, fields right) only on the review screen ≥1024px.
- Motion: 150–200ms ease-out transitions only; a single soft highlight pulse on values that just recomputed after a correction; respect prefers-reduced-motion.

**Craft details that separate premium from generic (implement all):**
- Real empty states (icon, one sentence, one action) — never a blank panel.
- Skeleton loaders for extraction ("Reading your document…"), never spinners alone; announce completion via aria-live.
- Field cards: raw text, normalized value, confidence as words (High / Medium / Could not read) with % on expand, status badge, Confirm / Correct / Show evidence actions — all reachable by keyboard with a visible 2px offset focus ring.
- Correction flow: inline edit → "What will update" preview listing affected outputs → explicit Confirm → version bump toast ("Profile updated to v3 — 4 items recomputed") with the pulse animation on updated values.
- Refusals and abstentions styled as calm informational panels (info-blue), never error-red — abstaining is correct behavior.
- Sticky "Uncertainty center" summary: n fields need confirmation, n missing, n expired, n blocked calculations — each item a link to fix it. No percentages, no scores, ever.
- The packet preview must look like a document someone would actually hand to a housing office: cover, confirmed values with evidence references, calculation sheet with formula steps, citation + effective date, checklist, unresolved-items section, manifest. Print-quality typography.
- shadcn/ui + Radix primitives for every interactive element; lucide icons; no hand-rolled dropdowns/modals/toasts.

### First task

Give me a phased plan for Phase 4 (contracts + placeholder data) and Phase 5 (vertical slice) from TODO.md, including the field state machine from the deep guide (proposed → confirmed | corrected→confirmed | rejected | unresolved), a profileVersion counter for the change-log UX, and the design-token setup as the very first UI step. Wait for my approval before writing code.

---

## CHECKPOINT PROMPTS (paste one at a time, after the previous phase is demonstrably working)

**C1 — after approving the plan:**
"Proceed with Phase 4: contracts, design tokens, placeholder rules.json (all numbers marked PLACEHOLDER), gold checklist, and the synthetic fixture generator including injection.pdf and conflict.pdf. Commit when tests pass."

**C2 — vertical slice, backend half:**
"Phase 5 backend: session service (create / upload / extract / real DELETE), tesseract.js OCR with word boxes, schema-constrained Claude extraction limited to the allowlist, value→token matching for exact bounding boxes, confidence rule (exact match high / fuzzy medium / none abstain). Prove it with a script that runs extraction on stub_clean.pdf and prints the ExtractedField JSON."

**C3 — vertical slice, UI half:**
"Phase 5 UI: upload screen and the field-review screen per the design tokens — document viewer with evidence highlights left, field cards right, confirm/correct flow with the 'what will update' preview and version-bump toast. Screenshot both breakpoints via Playwright, review, fix, then show me."

**C4 — engine + propagation:**
"Phase 5 engine: pure annualize/sum/compare functions with unit tests; single confirmedProfile store, all derived values computed from it; profileVersion counter + change log; calculations blocked with plain-language explanations when inputs are unconfirmed or frequency unknown. Demonstrate propagation: correct gross_pay in the UI and screenshot the updated annualization, comparison, checklist, and packet preview."

**C5 — checklist + packet:**
"Checklist engine against gold.json (statuses icon+text; unconfirmed document date → 'needs confirmation', never 'expired'); packet preview matching the premium document spec, renter-selected attachments, manifest, pdf-lib download. The downloaded PDF must match the preview exactly."

**C6 — Understand:**
"Rules Q&A: /rules and /rules/ask, full frozen corpus in context, answer only from corpus with citation + effective date, abstain otherwise; eligibility questions get the standard refusal-and-redirect. UI threshold numbers come from the engine, never from model text."

**C7 — safety panel:**
"Safety test panel running live: decision-request refusal; injection.pdf upload showing allowlist-only output and unchanged behavior (also test an injection in the FILENAME); unconfirmed-reuse block; real deletion proof (delete → re-fetch → 404); cross-session ID access rejected. Consent notice at upload; audit log without raw document content."

**C8 — accessibility:**
"Full keyboard-only journey via Playwright (upload → review → evidence → correct → confirm → ask → checklist → packet → download → delete); fix every failure; axe-core clean on all screens; aria-live announcements; 200% zoom check. Then hand me a list of anything that needs a human judgment call."

**C9 — closing:**
"Metrics page (field accuracy, source-box accuracy, abstention rate, test pass counts vs gold data), verify every step of docs/demo-script.md end to end via Playwright, finalize docs/risk-note.md, update TODO.md."

---

## If you must use a single one-shot prompt instead
Paste PROMPT 0 and append: "Execute all phases in TODO.md order autonomously. Stop and ask me only when a decision is irreversible or a prohibition in CLAUDE.md could be at risk. After each phase: run tests, screenshot via Playwright, commit, update TODO.md." Expect to review more carefully at the end — the checkpoint flow produces better results.
