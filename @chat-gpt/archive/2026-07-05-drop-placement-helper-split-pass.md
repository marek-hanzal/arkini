# Drop / placement helper split pass

Commit target: drop/placement LLM-friendliness cleanup after visual/audio planner split.

Changes:
- Split `src/play/drop/resolveBoardCellDropAction.ts` from a ~410-line mixed resolver into a thin board-cell drop orchestrator.
- Added dedicated board-cell drop action type/factory/branch files:
  - `BoardCellDropAction.ts`
  - `createBoardCellDropActions.ts`
  - `resolveBoardItemInteractionPlanDropAction.ts`
  - `resolveInventoryUtilityBoardCellDropAction.ts`
- Split `src/play/runtime/useGameRuntimeDropActions.ts` from a ~415-line hook/dispatcher into:
  - `drop/RuntimeDropActionContext.ts`
  - `drop/dispatchBoardItemDropActions.ts`
  - `drop/dispatchInventoryDropActions.ts`
  - `drop/createGameRuntimeDropActions.ts`
- Fixed the drag ghost issue where a dragged tile could keep following the pointer after pointer-up while accept/remove animation was settling.
  - `TileEngineActor.DragSession` now has `released`.
  - `useTilePointerUp` marks the session released immediately after pointer capture release.
  - `useTilePointerMove` ignores released sessions.
  - `useTileDragHover` ignores released sessions too.
  - Added `isLiveDragSessionForPointer` test coverage.

Validation notes:
- `npm run format:check` passed.
- `npm run audit:current` passed.
- `npm run audit:dupes` found 0 clones.
- `npm run game:schema:check` passed.
- `npm run game:validate -- game/arkini` passed with expected limited-deposit-softlock warnings for tree/forest/rock resources.
- `npm run dc` passed.
- `npm run typecheck` passed.
- Targeted drop/tile-engine tests passed: 32 tests.
- Full test suite was run in two chunks because the one-shot Vitest process hung in this environment after printing passed tests; split run covered all 102 test files / 622 tests and passed.
- `npm run build` passed with the existing Vite chunk-size warning.

Next likely cleanup:
- `checkInventoryItemPlaceReadinessFx.ts` can be split after this pass because the drop-action dispatch surface is now easier to reason about.
- After that, either `GameSaveSchema.ts` or a second producer lifecycle pass.
