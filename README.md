# RealDoor — Application-Readiness Copilot

The AI extracts, explains, retrieves, calculates, and prepares. **The renter confirms. A qualified human decides.**
Read `CLAUDE.md` (rules + prohibitions), `ARCHITECTURE.md`, `TEAM_PLAN.md` (roles/fences), and `TODO.md` (your task list) before working.

## Quick Start

Prereqs: Node 18+ (we use v24) and an OpenAI API key (each person uses their **own** key).

```bash
git clone <repo-url> realdoor-ai && cd realdoor-ai

# 1) server
cd server
npm install
cp .env.example .env        # then edit .env: set OPENAI_API_KEY=sk-...  (PORT stays 3001)
npm run dev                 # → RealDoor server listening on http://localhost:3001

# 2) web (second terminal)
cd ../web
npm install
npm run dev                 # → http://localhost:5173
```

Open **http://localhost:5173**, click "Choose a PDF", and upload
**`data/synthetic-docs/stub_clean.pdf`** — you should land on the review screen
with ~6 extracted fields (gross pay $1,580.00 at high confidence, one honest
"could not read" abstention is normal). "Show evidence" highlights the exact
source box in the document.

`server/.env` is gitignored and **never committed** — keys live only there,
never in web/, never in logs or client-visible errors.

## Everyday commands

| What | Where | Command |
|---|---|---|
| Web unit tests (contracts, engine) | `web/` | `npm test` |
| Server integration tests | `server/` | `npm test` |
| Live extraction proof on stub_clean | `server/` | `npm run prove` |
| Typecheck + production build | `web/` | `npm run build` |
| Regenerate synthetic fixtures | `web/` | `npm run fixtures` |
| Screenshot a route at 1280/380 | `web/` | `npm run screenshot <outDir> <route>` |

## Repo map

- `web/src/contracts/` — zod data contracts + field state machine. **FROZEN** — changes need 3-person agreement.
- `web/src/engine/` — deterministic math (Emmanuel). The LLM never calculates.
- `server/` — sessions, OCR + schema-constrained extraction, rules Q&A (Hoan).
- `data/` — frozen 2026 rules, gold checklist, synthetic fixtures. `docs/api.md` — the web↔server contract.
