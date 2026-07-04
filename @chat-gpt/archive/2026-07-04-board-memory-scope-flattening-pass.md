# Board memory scope flattening pass

Removed the last prop-only local `Context.Tag` from board-memory activation.

## Changed

- Flattened `BoardMemoryActivationScopeFx` in `src/board-memory/applyBoardMemoryActivateFx.ts`.
- Board-memory private helpers now receive explicit `BoardMemoryActivationScope` props instead of reading config/save/action/events through a local Effect context.
- Runtime behavior is intended to stay unchanged: layout save/restore, board-to-inventory transfer, inventory-backed restore, event emission, and next-wake calculation still run through the same shared Fx primitives.

## Rationale

Board-memory activation was the last local prop-only Context scope. It did not model an ambient service; it only hid stable orchestration props from function signatures. Passing the scope explicitly keeps the route grepable and avoids rebuilding local Effect service layers for one-file control flow.

After this pass, `src` contains only the three intended ambient Context services: `GameConfigFx`, `GameSaveDraftScopeFx`, and `RandomServiceFx`.
