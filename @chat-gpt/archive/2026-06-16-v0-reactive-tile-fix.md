# v0 reactive tile fix

Status: DONE

## Context

The v0 rewrite moved gameplay toward cache-owned optimistic state, but several bugs showed the runtime was still too coarse-grained:

- asset URLs rendered as `/src/v0/manifest/dsl/undefined` because the manifest asset URL helper pointed at the wrong relative asset root for Vite's dynamic `new URL` transform;
- activation/craft actions mostly waited for whole-view refreshes instead of updating the optimistic cache path directly;
- board craft/producer timers were read at the surface level and craft completion could stay stale until a refresh;
- board/inventory tile content was still mostly fed from surface-built tile payloads instead of tile-local query observers;
- inventory stash placement did not mirror the DB stacking choice and could visually split stacks into empty slots.

## Changes

- Fixed `pngSrc` to resolve PNG assets from `src/assets` instead of `src/v0/assets`.
- Added tile/cell-local query options over the durable board/inventory/item query caches:
  - `boardItemQueryOptions`
  - `boardCellItemQueryOptions`
  - `inventorySlotQueryOptions`
  - `itemViewQueryOptions`
- Moved board/inventory tile rendering into low-level tile components:
  - `BoardTile`
  - `InventoryTile`
- Moved board/inventory cell read state into `BoardCell` and `InventoryCell` instead of passing item/slot data through the surface render closures.
- Added `readLiveCraftView` so craft progress and `complete` derive from `nowMs` at the tile/cell edge instead of staying frozen in the cached board projection.
- Added `applyActionResultCachePatch` to apply server-confirmed visual events back into board/inventory caches without broad query refresh as the primary gameplay path.
- Activation inventory placements now carry `itemInstanceId`, so inventory-spawned stacks can keep real identities after server confirmation.
- Stash cache patch now prefers compatible existing stacks before empty slots when no explicit target slot is supplied.

## Acceptance

- Images load from built asset URLs instead of `/undefined`.
- Board/inventory tile content reads state through React Query selectors at the tile/cell edge.
- Activations, craft claims, inventory placement, merge/swap/move/stash actions apply result cache patches instead of relying on refetch as the normal game loop.
- Craft progress can tick from waiting to ready without a hard reload.
- Typecheck, format check, build, and diff check pass.
