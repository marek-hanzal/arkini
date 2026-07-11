# V1 item-owned location runtime

Implemented on `main` after the schema-contract audit.

## Decision

A live item is the single source of truth for its current concrete location:

```text
RuntimeItemSchema
├── id
├── item
├── location
│   ├── GridLocationSchema
│   │   ├── scope
│   │   └── position
│   └── InputLocationSchema
│       ├── ownerItemId
│       ├── lineId
│       ├── inputIndex
│       └── returnLocation
└── quantity
```

`LocationSchema` is a standalone domain contract in `src/v1/location`.

Runtime and persisted state intentionally share the same structural model:

```text
RuntimeSchema.items: RuntimeItemSchema[]
StateSchema.items:   StateItemSchema[]
```

State differs only by storing canonical `itemId` instead of the hydrated immutable item object.

There are no board/inventory storage containers, cell-key indexes, or runtime maps. Board and inventory are derived views filtered by `item.location.scope`. Position lookup is an explicit linear lookup over the small runtime item collection.

## Mutation boundary

The mutable `SynchronizedRef<RuntimeSchema>` is provided through internal `RuntimeStoreFx` and may be imported only by `GameLayerFx` and dedicated modules under `runtime/write`.

Public `RuntimeFx` is read-only. A static guard test enforces the internal-store import boundary.

There is no generic item patch/update command. Existing atomic commands are:

- `spawnItemFx`
- `moveItemFx`
- `removeItemFx`
- `setItemQuantityFx`
- `swapItemsFx`

Future mutations such as merge, split, replace, consume, or state-specific changes must receive their own single-responsibility atomic commands. They must never be implemented by exposing a general item patch.

## Runtime checks

Cross-item and configuration-dependent invariants do not live in Zod refinements. They are explicit readable runtime checks:

- duplicate live item identity;
- canonical item scope versus concrete grid location scope;
- grid location inside configured board/inventory bounds;
- unique grid-location occupancy;
- line-input owner, line, slot, selector, and aggregate capacity.

`checkRuntimeFx` returns schema-backed issues. `assertRuntimeFx` fails with `RuntimeInvalidError`.

Hydration and every write command validate a complete candidate runtime before it is atomically committed. Failed candidates never partially modify the runtime store.

## Core invariant

```text
Item owns identity, mutable state, and location.
Runtime owns the item collection and cross-item invariants.
Commands are the only mutation path.
Board, inventory, query, and persistence are derived consumers.
```
