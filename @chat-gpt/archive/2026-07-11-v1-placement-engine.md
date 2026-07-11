# V1 placement engine

Implemented after output resolution and the item-owned location/runtime command refactor.

## Contract boundary

`OutputResultSchema` remains a resolved, non-mutating description of emitted drops.
Placement is a separate domain that converts those drops into one atomic runtime mutation:

```text
OutputResultSchema
→ placeOutputFx
→ OutputPlacementResultSchema
```

A single resolved drop may also be placed through `placeDropFx`, which delegates to the output-level transaction instead of owning a second mutation route.

## Placement policies

- Placement is all-or-nothing for the complete output batch.
- Drops are planned and applied in authored order against one immutable runtime draft.
- If any later drop cannot be placed completely, no earlier placement is committed.
- Existing compatible stacks are filled before new runtime items are spawned.
- Board placement uses Manhattan-nearest ordering for `drop` and shuffled free locations for `random`.
- Board stacking remains deterministic and nearest-first; `random` affects new free-cell placement only.
- Items with `scope: any` use board first and inventory as fallback.
- Inventory-only items never attempt board placement.
- `replace` removes the exact board origin, spawns the first replacement stack at that location, and places any remaining quantity through normal board/inventory rules.
- Canonical `maxCount` is checked before placement capacity is consumed.
- A failed placement returns `PlacementUnavailableError` with an explicit reason and remaining quantity.

## Architecture

Planning and mutation are separate:

```text
planDropPlacementFx
├── planReplacePlacementFx
├── planBoardPlacementFx
│   └── planScopePlacementFx
├── planInventoryPlacementFx
│   └── planScopePlacementFx
└── mergePlacementPlansFx

placeOutputFx
├── planDropPlacementFx
├── applyPlacementPlanFx
└── assertRuntimeFx
```

`PlacementPlanSchema` owns remove/stack/spawn operations. `PlacementResultSchema` reports the concrete removed, changed, and spawned runtime items.

No lookup `Map` or parallel placement index exists. Runtime items remain the sole source of truth; location and stack lookups are derived by linear reads over the small runtime collection.

Only `placeOutputFx` imports the internal mutable runtime store. The runtime boundary test explicitly allows this command and rejects arbitrary direct store access elsewhere.

## Validation completed

- Full repo check: 68 test files, 129 tests.
- JSON Schema generation completed.
- Game pack completed for 249 JSON sources and 179 PNG assets.
