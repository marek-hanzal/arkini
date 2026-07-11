# V1 start bootstrap

Implemented after the output placement engine so new-game content uses the same placement plans and runtime invariants as later gameplay mutations.

## Contract boundary

The loaded game layer still starts with an empty runtime:

```text
GameLayerFx
→ fromConfigFx
→ RuntimeSchema { items: [] }
```

Creating a new game is an explicit command:

```text
GameConfigSchema.start
→ startFx
→ RuntimeSchema
```

Loading persisted state remains a separate path through `fromStateFx`. `GameLayerFx` does not silently apply start content before a save is hydrated.

## Planning

Start planning is non-mutating and follows the schema tree:

```text
StartSchema
→ planStartFx
  ├── BoardItemSchema     → planStartBoardItemFx
  └── InventoryItemSchema → planStartInventoryItemFx
```

- Board entries create exactly one item at their authored board coordinates.
- Board entries never use nearest-cell fallback, random placement, or inventory fallback.
- Inventory entries use the existing deterministic inventory stack-first planner.
- An inventory entry must fit completely; partial initial inventory plans fail with `StartInventoryUnavailableError`.
- Every fragment is applied to an immutable draft while planning so later start entries see earlier planned content.
- The complete candidate runtime is checked before a plan is returned.

## Atomic command

`startFx` is the only start mutation boundary and imports the internal runtime store explicitly.

- The runtime must be empty or `RuntimeNotEmptyError` is returned.
- The complete start plan is built before any state is committed.
- The plan is applied and validated inside one `SynchronizedRef.modifyEffect` transaction.
- Any unknown item, location conflict, forbidden scope, out-of-bounds coordinate, full inventory, or runtime invariant failure leaves the runtime unchanged.
- The command returns the resulting `RuntimeSchema.Type`; no duplicate start-result schema exists.

## Runtime quantity invariants

The start pass exposed that persisted state and direct commands could previously bypass placement-level count checks. The explicit runtime checker now also reports:

- `item:stack-size` when one live stack exceeds canonical `maxStackSize`.
- `item:max-count` when the total live quantity of one canonical item exceeds `maxCount`.

These checks remain readable runtime rules rather than hidden Zod refinements and protect start, state hydration, and every atomic runtime command.

## Validation completed

- Full repo check: 72 test files, 140 tests.
- The current Arkini authoring config boots into 14 live runtime items.
- JSON Schema generation completed.
- Game pack completed for 249 JSON sources and 179 PNG assets.
