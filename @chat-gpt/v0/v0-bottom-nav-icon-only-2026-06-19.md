# v0 bottom nav icon-only pass - 2026-06-19

Status: completed
Commit: TBD

## Scope

Small follow-up after the responsive grid fix.

## Done

- Bottom navigation now renders only icons visually.
- Labels remain available through `aria-label`, `title`, and screen-reader-only text.
- Button height, padding, gap and icon size now use viewport-aware `clamp(...)` values.
- Reduced the bottom navigation height so the game board gets more room back.

## Validation

- npm run format
- npm run typecheck
- npm run test
- npm run build
- npm run game:validate -- game/arkini
- npm run dc
