# v0 runtime rewrite

The active play route now enters `src/v0/play/PlayShell` instead of the historical `PlaySessionProvider` runtime.

Rules applied in v0:

- no app-owned React context; only vendor providers remain at the app shell boundary
- all durable data is read with `useSuspenseQuery`
- no `getQueryData` reads in v0 view/runtime code
- command/action execution uses `useMutation`
- command success writes fresh views into query cache with `setQueryData`, not invalidation/refetch guessing
- drag-facing commands patch React Query cache before the DB round-trip (`board.move`, `board.swap`, `board.merge`, `inventory.swap`, `inventory.place`, `inventory.stash`)
- union routing in v0 uses `ts-pattern` with `.exhaustive()` or a deliberate `.otherwise()` fallback
- drag/drop and tile motion are centralized in `src/v0/tile-engine`
- drag commit is delayed until after the snap animation so cache writes do not teleport the actor mid-drag
- old runtime code is preserved under `src/ancient` as a snapshot, while v0 is the active runtime

The v0 TileEngine is intentionally game-agnostic. Board and inventory provide slots, tiles, renderers, and drop decisions; the engine owns pointer lifecycle, hit testing, drag animation, FLIP movement, and drop handoff.

Known follow-up cleanup:

- remove or quarantine the old root play/drag UI runtime once v0 covers every interaction edge case
- expand detail cache patches for activation/craft/upgrade side effects only if the UX needs immediate derived-state feedback
- add focused browser/manual regression checks for drag-to-empty, swap, merge, stash, inventory swap, double-tap placement, and long-press detail sheet

## Follow-up cleanup: concrete v0 mutations

The generic `useGameCommandMutation` bridge has been removed from v0. v0 now uses one concrete domain action hook per gameplay action. Each hook owns exactly one Effect root, its cache patch if it needs one, rollback, and post-success cache reconciliation. Query options and keys now live inside the domain that owns the data instead of `src/v0/query`.

The drop resolver was split into `src/v0/play/drop/*`. The remaining `resolveDrop` file is intentionally just a small delegator from source/target pair to focused case resolvers. It receives concrete `DropActions` instead of a generic `Command` runner, so board/inventory surfaces expose their actual capabilities instead of piping every action through a mystery router.
