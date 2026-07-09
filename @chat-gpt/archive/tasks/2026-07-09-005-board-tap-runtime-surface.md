# 2026-07-09-005 Board tap runtime surface

## Problem
Board tap handling still spans a pure decision module and a runtime dispatch module with some extra ceremony. The current files are not broken, but they still read heavier than the gameplay warrants.

## Current hotspots
- `src/board/control/resolveBoardItemTapAction.ts`
- `src/board/handleResolvedBoardItemTapAction.ts`

## Goal
Simplify board tap routing without pushing side effects into the pure resolver and without adding new wrapper layers.

## Guardrails
- preserve current tap behavior for special items, craft, stash, producer, and default open-sheet fallback
- keep pure decision separate from runtime side effects
- prefer straightforward control flow over matcher ceremony

## Done when
- at least one of the board tap files is materially simpler
- no new abstraction layer is introduced
- board tap tests stay green

## Progress
- 2026-07-09: removed matcher-heavy routing from `resolveBoardItemTapAction.ts` and `handleResolvedBoardItemTapAction.ts` in favor of straightforward ordered control flow. Kept the pure-decision/runtime-side-effect split intact while reducing ceremony. Verified with board tap tests and typecheck.
