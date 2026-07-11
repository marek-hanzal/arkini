# V1 schema contract follow-ups

Audit performed after query, when, drop, output, and standalone line-rule evaluation were implemented.

Completed in the same pass:

- immutable `GameConfigSchema` was removed from mutable `RuntimeSchema`; config remains owned by `GameConfigFx`;
- every query/when/rule/output `origin` contract was narrowed from `RuntimeItemSchema` to `PositionSchema`;
- drop-rule evaluators now return neutral schema-backed rule results; only `dropFx` interprets enable gates and disable vetoes.

## Completed: runtime item location ownership

The runtime item versus placement decision is implemented.

- `LocationSchema` owns concrete `scope + position`.
- `RuntimeItemSchema` and `StateItemSchema` own their location directly.
- Runtime and state are flat item arrays with matching structure.
- Board/inventory are derived views; there are no cell-key records or maps.
- Public runtime access is read-only.
- Dedicated atomic commands own every mutation; generic item patching does not exist.
- Explicit runtime checkers validate IDs, scope, bounds, and location occupancy before hydration or command commit.

Full decision record: `@chat-gpt/archive/2026-07-11-v1-item-owned-location-runtime.md`.

## 1. Drop result cardinality

`dropFx` currently returns `DropResultSchema.Type[]`, although its contract is exactly zero or one result.

Introduce a schema-backed cardinality contract, for example:

```text
DropResultsSchema = array(DropResultSchema).max(1)
```

Alternatively model explicit resolved/discarded variants if downstream composition benefits from preserving rejection information. Do not use an untyped array alias.

## 2. Collection contracts derived from owner schemas

Some Fx props manually restate tuple shapes already owned by schemas:

```text
selectRollSetFx   -> readonly [RollSetSchema.Type, ...]
selectDropWeightFx -> readonly [DropWeightSchema.Type, DropWeightSchema.Type, ...]
```

Prefer types derived from the owning schema fields, such as `OutputSchema.Type["set"]` or `RollWeightSchema.Type["drop"]`, or introduce a named collection schema when the collection is independently meaningful.

The goal is to prevent runtime function contracts from drifting away from Zod structure.

## 3. When comparator boundaries

`whenFx` consumes `when.query`, then passes the whole `WhenCountSchema` or `WhenRangeSchema` to comparator leaves even though those leaves only use count/range values.

Choose one honest boundary:

- leaf evaluates the whole matching schema and therefore owns query resolution too; or
- leaf is a quantity comparator and accepts only the values it actually owns.

The current middle state is harmless but structurally imprecise.

## 4. Pack tooling result contracts

Several pack Fx return ad hoc `as const` objects rather than schema-backed results, including source collection, JSON reading, and directory packing.

This is lower priority because it is isolated tooling rather than gameplay runtime. Address it after gameplay contract boundaries are stable, using result schemas only where the values are real reusable domain contracts rather than temporary local tuples.

## Recommended order

```text
1. Add drop 0..1 result schema
2. Derive collection props from owner schemas
3. Tighten when comparator boundaries
4. Review pack tooling result contracts
```
