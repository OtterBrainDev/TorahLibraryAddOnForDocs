# UI Refactor Guardrails

## Primary goal
Centralize shared CSS and shared client JS infrastructure in this Apps Script add-on without changing the user-facing UI/UX.

## Non-negotiable constraints
1. Do not intentionally change visual appearance.
2. Do not intentionally change layout, spacing, typography, button order, copy, icons, or interaction timing.
3. Do not rename CSS classes or IDs that are currently used by existing markup/JS unless required for bug fixes and explicitly documented in the diff.
4. Do not remove page-specific CSS until shared CSS has been introduced and verified.
5. Do not move browser-only DOM code into `.gs` files.
6. Do not rewrite working UI flows just to match a new pattern.
7. Prefer extraction over redesign.
8. Preserve all current menu actions, sidebar flows, modal flows, and preference flows.
9. If a shared abstraction would require changing behavior, do not make that abstraction yet.
10. If uncertain whether code is shared or page-specific, leave it page-specific.

## Refactor strategy
1. Introduce shared files first.
2. Copy shared logic into the new files.
3. Wire one page at a time to the shared files.
4. Compare generated HTML/CSS/JS structure before and after each page migration.
5. Keep diffs small and reversible.

## Allowed changes
- Add shared include files.
- Add shared helper functions.
- Extract duplicate CSS declarations into shared partials.
- Extract duplicate client JS helpers into shared partials.
- Add test scripts and validation tooling.
- Add data-* hooks only if they do not alter layout or behavior.

## Changes requiring explicit justification in commit notes
- Any selector rename
- Any DOM structure change
- Any change to button order or labels
- Any style token introduction that changes computed styles
- Any event-binding strategy change
- Any server/client responsibility shift

## Definition of success
The add-on should look and behave the same to an end user, while shared infrastructure is cleaner and easier to maintain.
