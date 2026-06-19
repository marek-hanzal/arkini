# Task: Replace gameplay cache patching with raw snapshot/subtree subscriptions

Date: 2026-06-18
Status: IMPLEMENTED FIRST PASS
Priority: high, before broad UI overhaul if feasible

## Context

After T8, engine domain events are the single event language and `GameEngineVisualPlan` is just an adapter output for TileEngine motion/transient instructions. That removed one major mental layer.

The next mental load is gameplay cache patching. The current code still has places that treat UI cache as something to mutate by hand after actions. That is risky in a client-only offline game where the runtime engine already owns the authoritative `GameSave` snapshot.

Marek explicitly prefers moving more raw: read/subscribe to the source of truth and avoid hand-maintained cache where possible. That direction is correct.

## Goal

Replace manual gameplay cache patching with an optimized subscription model over authoritative runtime snapshots.

The target mental model:

```txt
GameSave + effective config = source of truth
        ↓
focused selectors / subtree subscriptions
        ↓
React views

GameEvent[]
        ↓
GameEngineVisualPlan
        ↓
TileEngine motion/transients only
```

Cache should not be a second source of truth. If a layer exists only to patch board/inventory state after an action, it is guilty until proven useful. Tiny dramatic courtroom, but someone has to judge this mess.

## Proposed direction

### 1. Inventory existing cache patching

Find every gameplay cache-like mutation path, especially under:

- `src/v0/play/cache`
- `src/v0/play/runtime`
- inventory/board view helpers that patch instead of deriving
- optimistic action handlers
- any leftover Query-style cache language

Classify each place:

- **source-of-truth read**: good, keep or optimize.
- **selector memoization**: allowed if it only caches derived values from a snapshot and cannot lie about state.
- **visual/motion state**: allowed outside save, but must be transient and driven by `GameEngineVisualPlan`.
- **manual gameplay state patch**: suspicious. Prefer remove.
- **optimistic gameplay patch**: probably remove unless it has a measured UX reason.

### 2. Define the raw/subscription runtime contract

Runtime store should expose the current snapshot and let UI subscribe to focused slices.

Preferred shape:

- `useGameRuntimeSelector(selector, equality?)`
- small focused hooks for common slices, for example board cells, inventory slots, tile detail, product lines, dev scenarios
- selectors are pure and read from snapshot/config
- derived views may be memoized by snapshot identity and selector identity, but not patched independently

Important rule: if an action succeeds, the authoritative runtime snapshot changes first. UI reads that snapshot. Visual plan may animate the transition, but must not become gameplay truth.

### 3. Review whether cache brings concrete value

Cache is only justified if it solves a real problem:

- expensive selector derivation that can be memoized safely
- stable reference identity for large views
- avoiding full React subtree redraws through fine-grained subscriptions
- temporary visual state that is not gameplay state

Cache is not justified for:

- board/inventory truth after actions
- working around engine events that do not contain enough info
- hiding expensive selectors that should be split
- optimistic patching purely from habit

### 4. Move toward subtree subscriptions instead of patched views

Target optimization is not “cache board and inventory, then patch them”.

Target optimization is:

- board subscribes to board view / board cells
- inventory subscribes to inventory slots
- tile detail subscribes to selected item detail
- dev sheet subscribes to dev-only scenario/runtime info
- individual components avoid receiving huge parent props when they only need one small value

This should reduce mental load and likely render load. Human brains and React both enjoy not being spammed. Rare agreement, cherish it.

### 5. Keep visual plan separate from truth

`GameEngineVisualPlan` remains useful. It should describe motion/transient intent only.

It may temporarily render old/new tile overlays, sequence enter animations, replacement cross-fades, etc.

It must not be used as a substitute save patch. If the visual plan and snapshot disagree, snapshot wins and the visual plan should be considered wrong or stale.

### 6. Remove or quarantine manual patchers

Expected cleanup candidates:

- `applyBoardVisualEvent` style patchers if any survived T8 under another name
- `applyInventoryVisualEvent` style patchers if any survived T8 under another name
- optimistic inventory stash patches
- manual board/inventory state patching after action success

Replacement should be:

- dispatch action
- runtime adapter applies engine result and stores new snapshot
- UI subscriptions update from snapshot
- visual plan animates the event batch

### 7. Testing strategy

Add/adjust tests around the runtime store, not just individual action effects.

Important tests:

- after action success, board UI selector reads the new snapshot without manual cache patching
- inventory selector reads stack/instance updates directly from snapshot
- visual plan can animate transition without changing gameplay snapshot
- failed action does not mutate snapshot and does not leave stale visual state
- selector subscriptions do not notify unrelated subscribers when their selected value is equal
- selected tile detail updates correctly when the tile changes, moves, is replaced or is consumed

Do not overfit tests to render internals. Test source-of-truth behavior and subscription boundaries.

## Acceptance criteria

Done when:

- there is no gameplay board/inventory cache patching after actions unless it has a documented measured reason
- board/inventory/detail UI reads from authoritative runtime snapshot selectors
- visual effects are explicitly transient and do not carry gameplay truth
- selectors/subscriptions are focused enough that parent components do not need to redraw the entire game for tiny changes
- old cache patching files are deleted or reduced to safe selector memoization utilities
- docs explain the difference between source-of-truth snapshot, derived selector memoization and visual transient state
- full gates pass

## Scope guard

Do not combine this with the broad UI overhaul.

This task may touch React runtime/view plumbing and delete cache patching code, but should not redesign colors, layout, header, dev sheet styling or button variants. UI overhaul comes after this if the runtime mental model is cleaner.

Do not change gameplay rules while doing this. If gameplay bugs appear, write them down separately unless they are directly caused by cache patching.

## Notes for implementation

Prefer small vertical slices:

1. Audit cache/patching files and document what each does.
2. Delete obvious dead patchers left after T8.
3. Convert one gameplay surface at a time to raw selector reads.
4. Add tests for selector/source-of-truth behavior.
5. Only add memoization where profiling or obvious structure needs it.

The danger is replacing one cache system with another fancy cache system under a nicer name. Do not do that. The win is fewer moving parts, not shinier moving parts.


## 2026-06-18 implementation checkpoint

First implementation pass removed derived `board`, `inventory` and `items` fields from `GameRuntimeStore`. The store now owns only the authoritative runtime snapshot, revision and action time. React hooks derive board/inventory/catalog/upgrade views from raw snapshot selectors; visual effects derive their previous/current board snapshots only when building `GameEngineVisualPlan`.

Remaining acceptable work: split broad view readers into finer `boardItem`/`inventorySlot` readers later if profiling or complexity demands it. Do not reintroduce a gameplay cache patching layer.

## 2026-06-18 focused subscription checkpoint

Second implementation pass reduced broad render subscriptions without changing gameplay rules. Board drop commits now read inventory/config from the latest raw snapshot at commit time instead of subscribing board rendering to inventory changes. Inventory rendering now subscribes to inventory plus focused `firstEmptyCell` instead of full board/config. Item detail subscribes to the selected board item instead of the full board. See `v0-focused-runtime-subscriptions-2026-06-18.md`.

## 2026-06-18 runtime reader hygiene checkpoint

Third implementation pass split the catch-all runtime reader file into focused reader modules under `src/v0/play/runtime/readers/*`, added direct `boardItem`, `inventorySlot` and `firstEmptyCell` raw readers, and gave board/inventory root hooks semantic equality so derived view object churn does not force unrelated redraws. Grep found no surviving gameplay cache patching paths under `src/v0`; only safe config-keyed item catalog memoization remains. See `v0-runtime-reader-hygiene-2026-06-18.md`.
