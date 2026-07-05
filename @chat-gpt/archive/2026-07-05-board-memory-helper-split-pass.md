# 2026-07-05 board memory helper split pass

Commit: see git log (`Split board memory activation helpers`)

## What changed

- Split `src/board-memory/applyBoardMemoryActivateFx.ts` by owned responsibility.
- Kept `applyBoardMemoryActivateFx` as the actor validation and save-vs-restore router.
- Added `BoardMemoryActivationTypes.ts` for shared activation scope/layout item types.
- Added `readBoardMemorySnapshotFx.ts` for current layout capture.
- Added `storeCurrentBoardItemsInInventoryFx.ts` for board-to-inventory stashing before restore.
- Added `restoreBoardMemoryLayoutItemsFx.ts` for board-only and inventory-backed restore details.
- Added `saveCurrentBoardMemoryLayoutFx.ts` and `restoreSavedBoardMemoryLayoutFx.ts` for route-level save/restore state changes and events.
- Added `readBoardMemoryEngineResultFx.ts` for shared result assembly.

## Rationale

Board-memory activation was already free of prop-only `Context.Tag`, but it was still a large mental-load blob mixing snapshot capture, current-board stashing, restore source matching, inventory consumption, board placement, memory layout save/remove, events, and engine result assembly.

The split preserves behavior while keeping each board-memory path in the file that owns the relevant stage. Future memory behavior should extend the owned helper rather than adding the old all-in-one activation blob back.

## Validation

- `npm run format:check`
- `npm run audit:current`
- `npm run game:schema:check`
- `npm run game:validate -- game/arkini` (valid with known finite-deposit softlock warnings for double-tree, micro-forest, rock, tree)
- `npm run dc`
- `npm run typecheck`
- `npm run audit:optional`
- `npm run build`
- Relevant tests: `applyBoardMemoryActivateFx`, `applyGameActionBoardInventoryFx`, `readActionReadinessFx`, `RuntimeGameEngineAdapter`
- Full `npm run test` and `npm run check` reached passing test output but timed out in the sandbox during monolithic Vitest, with no assertion failure observed.
