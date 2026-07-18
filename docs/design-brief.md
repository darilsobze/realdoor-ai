# Design Brief — RealDoor UI

## North star
Calm, trustworthy, government-service clarity — closer to gov.uk than to a startup dashboard. The user is stressed and time-poor; the UI's job is to reduce anxiety by making evidence, status, and next steps unmistakable. Nothing flashy, nothing ambiguous, nothing that looks like a verdict.

## Aesthetic direction
- Generous whitespace, single-column focus per task, max content width ~880px for reading comfort.
- Typography: one humanist sans (e.g. Inter or Source Sans 3). Base 16px, 1.5 line height. Clear heading hierarchy h1→h3, no decorative fonts.
- Palette: near-white background, ink-navy text, one calm primary (deep blue) for actions. Status colors are SECONDARY signals only — every status also has an icon + text label. Amber = needs attention, red = blocking, green = confirmed; all AA-contrast on their backgrounds.
- Motion: minimal; only focus transitions and a brief highlight pulse when a downstream value updates after a correction (paired with an aria-live announcement).

## Component conventions
- shadcn/ui + Radix primitives only; no hand-rolled interactive divs.
- Status badge = icon + text (e.g. ⚠ "Needs confirmation"), never color alone.
- Evidence view: document left, fields right on desktop; stacked on mobile. Active field's source box gets a 2px primary outline + subtle scrim on the rest of the page.
- Confidence shown as words ("High / Medium / Could not extract"), with the % available on hover/expand — words first, numbers second.
- Every important result carries "Show evidence / Show formula / Show source" affordances inline, not buried in menus.
- Correction flow: inline edit → "What will update" preview (annualized income, comparison, packet) → explicit Confirm.
- Refusals and abstentions are styled as calm informational panels, not error states — abstaining is correct behavior, the UI should not make it feel like failure.
- Disclaimer ("This is not an eligibility decision…") appears on the comparison result and packet cover as body text, not fine print.

## Language
Plain language, ~8th-grade reading level. Say "money you earn before taxes" alongside "gross pay". Never "eligible", "qualify", "approved", "score", "chance". Buttons are verbs: "Confirm this value", "Download my packet", "Delete everything".

## Accessibility acceptance criteria (WCAG 2.2 AA — check every screen)
1. Entire journey completable keyboard-only; logical tab order; visible focus ring (2px, offset) on every interactive element.
2. Modals trap focus and return it to the trigger on close.
3. Every input has a programmatic label; every error is linked via aria-describedby and understandable.
4. aria-live=polite announcements for: extraction complete, downstream values updated, packet ready, session deleted.
5. No information conveyed by color alone; contrast ≥ 4.5:1 body, 3:1 large text/UI.
6. Layout usable at 200% zoom and 320px width; document viewer degrades to paged navigation.
7. Loading states named ("Reading your document…") and completion states announced.

Definition of done for any UI task: Playwright keyboard pass + axe-core scan clean on the affected screens.
