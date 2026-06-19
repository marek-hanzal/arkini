# Merge/remove domain extraction

Status: done.

Moved merge and tile removal runtime behavior out of `src/v0/game/engine/fx`:

- `src/v0/game/merge/checkItemMergeReadinessFx.ts`
- `src/v0/game/merge/mergeItemFx.ts`
- `src/v0/game/merge/applyGameActionMergeFx.test.ts`
- `src/v0/game/remove/checkTileRemoveReadinessFx.ts`
- `src/v0/game/remove/removeTileFx.ts`
- `src/v0/game/remove/applyGameActionRemoveFx.test.ts`

Shared board runtime-state helpers moved to `src/v0/game/board` because stash, craft, requirements, merge, and remove all need to reason about board item runtime state cleanup/status:

- `readBoardItemRuntimeStateStatus.ts`
- `removeBoardItemRuntimeState.ts`

`src/v0/game/engine/fx` now keeps only orchestration/config/bootstrap/helper leftovers. Merge/remove are top-level game domains, not engine-owned Effect plumbing.

No behavior change intended.
