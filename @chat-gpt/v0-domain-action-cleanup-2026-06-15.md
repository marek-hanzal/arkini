# v0 domain action cleanup - 2026-06-15

## Decision

`src/v0/mutation` was removed. v0 action hooks now live in the domain that owns the action:

- board actions in `src/v0/board/action`
- inventory actions in `src/v0/inventory/action`
- item-sheet actions in `src/v0/item/action`
- upgrade actions in `src/v0/upgrade/action`

Cache helpers live next to the view cache they patch or refresh. Cross-domain cache snapshots and refresh groups live in `src/v0/play/cache` because they describe play-screen cache state, not a fake mutation layer.

## Rules confirmed

- v0 does not use `getQueryData`.
- v0 does not use `useQuery`; all UI reads go through Suspense query options.
- v0 action hooks run Effect roots through `runGameFx`.
- v0 action hook error types stay `unknown` so Effect failures are not typed away as generic `Error`.
- Cache patching is the default architecture, so active v0 code does not use `optimistic` names.
- `dbFx` is a single file again; there is no exported `dbFxImpl` wrapper file.
- `withTransactionFx` owns manual start/commit/rollback and only re-provides the Kysely transaction context.
- `runEffect` accepts the actually-required runtime dependency subset instead of forcing every Effect root to pretend it needs the whole runtime.
