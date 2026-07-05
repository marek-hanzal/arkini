# 2026-07-05 Inventory placement readiness helper split pass

## Goal

Continue the drop/placement cleanup after the board-cell/runtime drop action split. Keep `checkInventoryItemPlaceReadinessFx` as a small orchestration Effect and move the exact/nearest placement validation details into focused helpers.

## Changes

- Split `src/placement/checkInventoryItemPlaceReadinessFx.ts` from ~418 lines to 39 lines.
- Added `InventoryItemPlaceReadinessTypes.ts` for the shared props/draft/slot/mode types.
- Added `readInventoryPlacementDraftFx.ts` for target-cell assertion, slot lookup, storage validation, quantity validation, and preview save creation.
- Added `assertExactInventoryPlacementReadinessFx.ts` for exact single-cell placement validation.
- Added `assertNearestInventoryPlacementReadinessFx.ts` for nearest-by-Manhattan instance/stack placement validation.
- Added `readBoardPlacementCapacityFx.ts` and `readSaveAfterInventoryRemovalPreviewFx` as narrow placement helpers.

## Behavior

No intended behavior change. This is a structural split only.

## Validation

- `npm run format:check`
- `npm run audit:current`
- `npm run audit:dupes`
- `npm run game:schema:check`
- `npm run game:validate -- game/arkini`
- `npm run dc`
- `npm run typecheck`
- `npm run build`
- Test suite verified in 4 chunks with `--pool=forks`: 102 files / 622 tests passed.

`npm run test` still reaches the passing test output but hangs in this container before the final summary, same kind of runner/process-exit weirdness seen in nearby passes. Chunked fork runs completed cleanly.
