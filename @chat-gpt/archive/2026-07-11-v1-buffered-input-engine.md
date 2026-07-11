# V1 buffered input engine

Implemented after start and placement runtime were complete.

## Semantic boundary

Material inputs are directly delivered, line-owned buffers. They do not scan the
board or inventory and do not consume arbitrary matching runtime items merely
because a line is inspected.

```text
InputSimpleSchema
→ resolveInputSimpleFx
→ InputSimpleResolutionSchema

InputMaterialSchema + buffered quantity
→ resolveInputMaterialFx
→ InputMaterialResolutionSchema

Delivered grid item + material resolution
→ planInputMaterialStoreFx
→ InputMaterialStorePlanSchema | undefined
```

A simple input owns no resource requirement and is always ready. A material
input reports required bounds, stored quantity, next-run quantity, missing
quantity, total buffer capacity, available capacity, mode, and readiness.

Deposit input resolution remains intentionally unimplemented until deposit
capacity has its own runtime-state contract.

## Input-owned locations

Buffered materials remain ordinary runtime items and continue to own their one
current location. `LocationSchema` is now the union of:

```text
GridLocationSchema
├── board
└── inventory

InputLocationSchema
├── ownerItemId
├── lineId
├── inputIndex
└── returnLocation: GridLocationSchema
```

There is no parallel input bucket, map, or save-only representation. Runtime and
state keep the same item/location structure. Board, inventory, and `any` queries
exclude input-located items because those materials are no longer present on a
grid.

Generic grid movement and swapping reject input-located items. Entering a line
input is possible only through the dedicated material-store command.

## Atomic material delivery

```text
storeInputMaterialFx
├── readRuntimeItemByIdFx
├── readItemMaterialInputFx
├── filterInputMaterialItems
├── planInputMaterialStoreFx
├── applyInputMaterialStorePlanFx
└── assertRuntimeFx
```

`storeInputMaterialFx` owns the sole mutable-store transaction. It reads one
immutable runtime snapshot, builds the accepted store plan, applies it to an
immutable draft, validates the complete candidate runtime, and commits once.

- A fully accepted stack keeps its runtime identity and moves to the input
  location.
- A partially accepted stack remains on its grid with reduced quantity and a
  newly identified buffered runtime item owns the accepted quantity.
- Requested quantity, source quantity, selector matching, and remaining input
  capacity all limit acceptance.
- Failed delivery changes no runtime item.
- `returnLocation` records the source grid location for future reserve/cancel
  return behavior; actual return placement is not implemented in this pass.

## Runtime checks

The explicit runtime checker validates input locations separately from grid
locations:

- owner runtime item exists;
- configured owner line exists;
- input index identifies a material input;
- buffered canonical item matches the input selector;
- aggregate buffered quantity does not exceed required maximum plus capacity.

Input state round-trips through the same `StateSchema` and is validated again on
hydration.

## Deferred lifecycle

This pass ends at buffered readiness and delivery. The next input layer must own
job-facing operations without broadening the store command:

```text
resolve line inputs
→ plan one run's consume/reserve quantities
→ atomically start job and apply input plan
→ complete/cancel job
→ consume or return reserved input items
```

Withdraw and reserve return placement must use dedicated commands. They must not
expose a generic location patch or make material inputs scan the world.
