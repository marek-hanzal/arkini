# v0 local placement planner

Status: completed 2026-06-18
Commit: see current task commit `Add local board placement planner`

## What changed

Producer/stash/craft/scheduled output placement now supports an optional board `seedCell` and uses a shared empty-cell planner instead of always scanning from top-left.

The planner lives in `src/v0/game/engine/fx/planEmptyBoardCellsFx.ts` and orders cells deterministically:

1. no seed: existing global board scan order, top-to-bottom / left-to-right;
2. with seed: nearest cells by Manhattan distance from the seed, with the same scan order as the tie-breaker.

`findFirstEmptyBoardCellFx` now delegates to this planner, so existing no-seed placement behavior remains compatible.

## Runtime usage

- Producer completion preflights with the producer board cell as seed.
- Scheduled item spawn processing derives the seed from `originItemInstanceId`, so delayed/queued spawn events still place around their producer/stash/craft source if it remains on board.
- Stash opening preflights with the stash board cell as seed.
- Craft completion preflights around the craft target board cell.

The scheduled spawn event still stores only `originItemInstanceId`; no schema bump was needed. If the origin item is gone by the time the spawn is processed, placement falls back to global scan order.

## Tests

Added coverage for direct seeded placement and runtime producer output placement around a centered producer.

## Follow-up

Inventory-to-board placement can reuse the same planner when long-press empty-cell placement is implemented. That task should pass the long-pressed empty cell as `seedCell` and then consume inventory stacks into planned cells, not create a second placement algorithm like a tiny duplicated swamp.
