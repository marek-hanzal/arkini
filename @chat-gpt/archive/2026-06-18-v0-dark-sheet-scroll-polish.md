# v0 dark sheet scroll polish - 2026-06-18

Status: completed
Commit: TBD

## Scope

Follow-up after screenshot review of the dark UI pass.

## Done

- Darkened the global Arkini palette again:
  - page and board are now nearly black violet;
  - sheet/card surfaces are darker;
  - borders were pulled close to the box backgrounds so they read as subtle structure instead of bright wireframes.
- Changed `BottomSheet` so the panel no longer owns vertical scrolling.
- Moved scrolling into the sheet content bodies under each fixed header:
  - inventory body;
  - upgrades body;
  - item detail body;
  - dev sheet body.
- Kept sheet headers fixed while body content scrolls underneath.
- Kept scrollbars visually hidden on scrollable sheet bodies.
- Cleaned up remaining light surfaces in product lines, runtime fallback, item level badges and maxed upgrade states.

## Validation

- npm install
- npm run format
- npm run typecheck
- npm run test
- npm run build
- npm run game:validate -- game/arkini
- npm run dc
