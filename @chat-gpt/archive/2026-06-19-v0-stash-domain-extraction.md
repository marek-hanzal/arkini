# v0 stash domain extraction

Moved stash runtime/action files out of `src/v0/game/engine/fx` into top-level `src/v0/game/stash`.

Rule confirmed: `game/engine` is orchestration only. Stash is a top-level game domain, not `engine/stash`.

Moved files:

- `applyGameActionStashFx.test.ts`
- `applyStashDepletionFx.ts`
- `checkBoardItemStashReadinessFx.ts`
- `checkStashOpenReadinessFx.ts`
- `openStashFx.ts`
- `readStashBoardItemFx.ts`
- `readStashRemainingChargesFx.ts`
- `stashBoardItemFx.ts`

`game/engine/fx` count after this cut: 78 files.

No behavior changes intended.

Next likely cut: extract placement helpers into `src/v0/game/placement`.
