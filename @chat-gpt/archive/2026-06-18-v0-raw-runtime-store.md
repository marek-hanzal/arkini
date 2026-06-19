# v0 raw runtime store pass

Date: 2026-06-18
Commit: see git log entry "Read runtime views from raw snapshot"
Status: IMPLEMENTED

## Why

After the event visual planner cleanup, the next mental-load source was the runtime store holding derived gameplay views (`board`, `inventory`, `items`) as part of its root state. Those views were not manually patched anymore, but they still acted like a cached second shape next to the authoritative engine snapshot.

The new rule is simpler:

```txt
RuntimeGameEngineAdapter snapshot = source of truth
GameRuntimeStore = raw snapshot + revision + nowMs
React hooks = derive board/inventory/catalog/upgrade views from snapshot selectors
GameEngineVisualPlan = transient animation plan only
```

No board/inventory gameplay truth lives in `GameRuntimeStore` anymore. If a component wants board or inventory, it derives it from `runtime.save + runtime.config` through focused hooks.

## What changed

- `GameRuntimeState` now contains only:
  - `runtime`
  - `revision`
  - `nowMs`
- Removed cached root fields:
  - `board`
  - `inventory`
  - `items`
- Added `src/v0/play/runtime/readGameRuntimeViews.ts` as a non-React view reader module.
- `useGameRuntimeViews.ts` now derives views through selector hooks instead of reading cached fields.
- `GameRuntimeVisualEffects` derives previous/current board and current inventory from raw snapshots when building the visual plan.
- Debug/runtime counters now read directly from `runtime.save`, not from derived board/inventory views.
- TileEngine wording was cleaned up from old “cache snapshot” language to “derived snapshot”.

## Important boundary

This pass did not rewrite TileEngine or gameplay rules. It removed the derived-view cache from the runtime store and tightened the source-of-truth mental model.

Allowed remaining memoization:

- `readRuntimeItemCatalogViewFromGameConfig` still uses `WeakMap<GameConfig, ItemCatalogView>`. That is safe derived memoization keyed by immutable/effective config identity, not a gameplay cache patch.
- TileEngine motion/transient stores remain visual-only. They are not gameplay truth.

## Next cleanup ideas

The store is now raw, but some hooks still derive broad views before selecting a single item/slot. That is acceptable for this pass, but if rendering gets heavy, split dedicated readers:

- `readRuntimeBoardItemViewFromGameSave`
- `readRuntimeInventorySlotViewFromGameSave`
- `readRuntimeBoardCellStatusFromGameSave`

Do that only when useful. Do not build a shiny new cache system under a selector-shaped mask, because that would be humanity inventing a rake and stepping on it again.
