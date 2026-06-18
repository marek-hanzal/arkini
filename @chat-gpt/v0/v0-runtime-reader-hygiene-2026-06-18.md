# v0 runtime reader/subscription hygiene checkpoint

Date: 2026-06-18
Commit: pending

## Context

After raw runtime store and focused subscription passes, the remaining cleanup target was not another cache rewrite. The point was to keep cutting mental load:

- find broad subscriptions that recompute large derived views for tiny consumers
- verify old gameplay cache patching is gone
- prevent catch-all runtime reader modules from becoming the next god-object reader barrel
- keep selectors stable and cheap, not a shiny cache system with a nicer haircut

## What changed

### Reader files split by intent

Deleted the old catch-all `src/v0/play/runtime/readGameRuntimeViews.ts` module.

Added focused reader modules under `src/v0/play/runtime/readers/*`:

- `readBoardView`
- `readBoardItem`
- `readBoardFirstEmptyCell`
- `readInventoryView`
- `readInventorySlot`
- `readItemCatalogView`
- `readItemView`

`src/v0/play/runtime/readers/index.ts` remains only a tiny barrel. It must stay boring. If it starts growing logic, slap it with a wet lint rule and split the logic back out.

### Focused readers avoid full view rebuilds

`useGameBoardItem` now reads one board item through `readRuntimeBoardItemViewFromGameSave` instead of rebuilding the whole board view and indexing into it.

`useGameInventorySlot` now reads one inventory slot directly from raw save instead of rebuilding the full inventory view.

`useGameBoardFirstEmptyCell` now reads raw board occupancy and config dimensions directly. It no longer builds a full board view just to answer “where is the first hole?”. Also, this path now respects `config.game.board.width/height` instead of the old hardcoded board helper dimensions. Tiny config bug, tiny shovel, buried.

### Board/inventory root subscriptions use semantic equality

`useGameBoardView` and `useGameInventoryView` now pass equality functions to `useGameRuntimeSelector`.

This matters because deriving a board/inventory view creates new object identities. Without semantic equality, every runtime revision could look like a changed view even if the selected surface did not meaningfully change. That would be a recompute-shaped cache mess wearing a fresh hat.

The equality functions compare stable view meaning:

- board item ids, item ids, positions, activation/craft/state payloads and first empty cell
- inventory slots, stack ids, item ids, quantities, statefulness/state payload and first empty slot

### Stable selector closures

Focused hooks with parameterized selectors now use `useCallback`, so selector identity does not churn every render unless the parameter actually changes.

Affected hooks:

- `useGameBoardItem`
- `useGameInventorySlot`
- `useGameUpgradeListView`
- `useGameItemView`

`useGameRuntimeSelector` intentionally keys its tiny selected-value memo by root snapshot and selector identity, so stable selector closures matter.

### Cache patching audit

A source grep found no surviving gameplay cache patching files or `setQueryData`/optimistic patch paths under `src/v0`. The only remaining `cache` string in runtime code is the safe `WeakMap<GameConfig, ItemCatalogView>` memo in `readRuntimeItemCatalogViewFromGameConfig`.

That WeakMap is acceptable because config identity is immutable/effective and the memo cannot lie about gameplay state. It is derived selector memoization, not board/inventory truth.

## Tests

Added `src/v0/play/runtime/readers/readers.test.ts` to cover focused readers. Follow-up naming cleanup removed redundant `GameRuntime` from reader filenames/functions:

- one board item reader matches the full board view item
- first-empty-cell reader uses raw save coordinates and config board dimensions
- one inventory slot reader derives slot stack view without the full inventory view

## Current mental model

Runtime truth:

```txt
GameRuntimeState.runtime.save + GameRuntimeState.runtime.config
```

Derived render state:

```txt
focused reader(selector input) -> view value
```

Allowed memoization:

- `useGameRuntimeSelector` last selected value by root snapshot + selector identity
- item catalog WeakMap by config identity
- visual TileEngine transient/motion stores

Not allowed:

- board/inventory gameplay cache patching after actions
- visual plan becoming save truth
- selectors hiding a new mutable cache layer

## Follow-up guardrails

- Keep new readers tiny and domain-specific.
- If a reader needs to understand board, inventory, items, upgrades and jobs all at once, it is probably a use-case reader and should be named as such, not hidden in a generic runtime reader pile.
- Do not reintroduce React Query or manual patch paths for board/inventory truth.
- If a selector gets expensive, first split it by use case. Memoize only after the shape is clean.
