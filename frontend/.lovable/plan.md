# Homepage redesign

Rework `src/routes/index.tsx` into a marketing-style landing page inspired by the three reference screenshots, while keeping all existing session logic (`useSession`, `enter("normal" | "demo")`) intact. No business logic changes.

## 1. Hero section (ref image 1)

Full-viewport-height hero with a static background image (we'll swap in video later — plain `<img>` / CSS background for now, no `<video>` tag) and a dark gradient overlay for contrast.

- Background: one generated cinematic photo saved to `src/assets/hero-doorway.jpg` (a person walking through an apartment building doorway, warm daylight, civic-tech mood). Imported as an ES6 module.
- Overlay: `bg-gradient-to-b from-navy/70 via-navy/50 to-background` so the deep-navy text tokens still read as light-on-dark here (use white/near-white foreground locally — this is the one place we deviate from the light base, matching the reference).
- Centered content:
  - Eyebrow: "Application-Readiness Copilot"
  - H1 (kept verbatim per request): "Understand your documents. Read the rules. Prepare your packet."
  - Sub: existing one-liner about RealDoor + metro.
  - A subtle scroll-cue chevron at the bottom.
- Preserve the top warning banner ("This copilot does not decide eligibility") but move it directly under the hero as a slim strip so it stays prominent without breaking the cinematic feel.

## 2. Steps section (ref image 2)

Replaces the current 3 `StepCard`s with a bolder card row that echoes the reference:

- Section eyebrow: "HOW IT WORKS"
- Heading: "Three steps to a packet you control"
- 3 large cards (Profile / Understand / Prepare), each with:
  - Colored top-label chip (e.g. `PROFILE`, `UNDERSTAND`, `PREPARE`)
  - Bold headline (existing body copy tightened to one line)
  - Short description
  - Bottom link "Learn more →" (non-navigating, decorative — real navigation is in the CTA band below, to avoid duplicating entry points and to keep the "confirm mode first" flow)
- Highlight the middle card with the primary color background + inverted text (mirrors the orange highlighted card in the reference), the other two stay light with navy text.
- Staggered fade-in animation preserved.

## 3. Mode CTA band

Keep the two existing `ModeCard`s but restyle as a wider two-column band under the steps:

- Left card (primary): "Use your own documents" → calls `enter("normal")`.
- Right card (secondary): "Try the safety demo" → calls `enter("demo")`.
- Same "Before you begin" privacy block moves directly under this band, unchanged in copy.

## 4. Footer (ref image 3)

New `<footer>` at the bottom of the landing route (landing-only, not global — the top bar already handles in-app nav). Four columns of plain-text links, matching the reference layout:

- **RealDoor**: About, How it works, Rule sources, Accessibility
- **Program**: Metro coverage, Rule version, Effective date, Changelog
- **Support**: FAQ, Contact, Report an issue, Responsible disclosure
- **Contact**: email placeholder, "Human review only", "Synthetic data only" reminder

All links are `<a href="#">` placeholders for now (no new routes) since none of these pages exist yet — labels only. A thin top border, muted foreground text, and a bottom line: "Simulated prototype. Not affiliated with any housing authority. © 2026."

## Files touched

- `src/routes/index.tsx` — full rewrite of the layout; keep `useSession`, `enter()`, imports.
- `src/assets/hero-doorway.jpg` — new, generated image (fast tier, 1600×900-ish).
- No changes to routes, session, domain, or components outside this file.

## Non-goals

- No video element yet (static background, per request).
- No new routes for footer links.
- No changes to Profile / Understand / Prepare / Safety.
- No copy that implies eligibility, scoring, or acceptance — footer and cards use neutral, preparation-only language.

## Accessibility

- Hero H1 stays the single `<h1>`; section headings are `<h2>`.
- Background image gets empty `alt=""` (decorative); text contrast ≥ 4.5:1 against the overlay.
- Footer uses a `<nav aria-label="Site">` with column headings as `<h2 className="sr-only-ish">` visible labels.
- All CTAs remain real buttons with visible focus rings.
