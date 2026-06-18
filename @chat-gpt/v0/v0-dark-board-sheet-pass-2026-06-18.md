# v0 dark board / sheet polish pass - 2026-06-18

Status: completed
Commit: TBD

## Scope

Follow-up visual pass requested after the first violet/light redesign.

## Done

- Switched the active game UI to a dark palette built around deep violet surfaces with pink accents.
- Removed game-screen padding so the board can render edge-to-edge.
- Removed the bottom-nav top border and kept only the three action buttons.
- Reworked sheet headers so the title is truly centered on a single row and the close button is absolutely aligned on the right.
- Hid visible vertical scrollbars on scrollable sheet containers.
- Simplified the developer sheet runtime/storage area to a single hard-reset action only.
- Kept the dev top-row action buttons equal width via a 2-column grid.
- Removed the scenarios-count pill from the developer sheet.
- Updated board/inventory surfaces, cells, cards, pills, buttons and error toasts to match the dark token set.

## Validation

- npm install
- npm run format
- npm run typecheck
- npm run test
- npm run build
- npm run game:validate -- game/arkini
- npm run dc
