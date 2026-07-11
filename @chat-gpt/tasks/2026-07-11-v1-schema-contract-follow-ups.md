# V1 schema contract follow-ups

Audit performed after query, when, drop, output, and standalone line-rule evaluation were implemented.

Completed in the same pass:

- immutable `GameConfigSchema` was removed from mutable `RuntimeSchema`; config remains owned by `GameConfigFx`;
- every query/when/rule/output `origin` contract was narrowed from `RuntimeItemSchema` to `PositionSchema`;
- drop-rule evaluators now return neutral schema-backed rule results; only `dropFx` interprets enable gates and disable vetoes.

## 1. Runtime item versus grid placement

This is the next issue to investigate before input runtime.

Current runtime and state items contain `scope`, `x`, and `y`, while their owning container and cell key already encode the same information:

```text
runtime.board / runtime.inventory -> scope
cells["2:1"]                      -> x/y
RuntimeItemSchema                 -> scope + x + y
```

The same duplication exists in state. A cell key, container scope, and item fields may disagree. `setItemFx`, `fromStateFx`, and `fromRuntimeFx` currently synchronize or reconstruct these copies manually.

Do not patch this locally. First decide the intended ownership model. Candidate direction:

```text
RuntimeItemSchema
├── id
├── item
└── quantity

Grid container owns scope
Cell key owns position
```

If a located item is needed as a first-class value, introduce a dedicated placement/entry schema instead of making the item itself own grid coordinates.

Questions to resolve:

- whether persisted `StateItemSchema` should also lose `scope/x/y`;
- whether cell keys remain serialized strings or become structured entries;
- where cell-key parsing and validation belong;
- whether APIs return an item, a placement, or a composed located-item result;
- how moves preserve item identity without copying location fields.

## 2. Drop result cardinality

`dropFx` currently returns `DropResultSchema.Type[]`, although its contract is exactly zero or one result.

Introduce a schema-backed cardinality contract, for example:

```text
DropResultsSchema = array(DropResultSchema).max(1)
```

Alternatively model explicit resolved/discarded variants if downstream composition benefits from preserving rejection information. Do not use an untyped array alias.

## 3. Collection contracts derived from owner schemas

Some Fx props manually restate tuple shapes already owned by schemas:

```text
selectRollSetFx   -> readonly [RollSetSchema.Type, ...]
selectDropWeightFx -> readonly [DropWeightSchema.Type, DropWeightSchema.Type, ...]
```

Prefer types derived from the owning schema fields, such as `OutputSchema.Type["set"]` or `RollWeightSchema.Type["drop"]`, or introduce a named collection schema when the collection is independently meaningful.

The goal is to prevent runtime function contracts from drifting away from Zod structure.

## 4. When comparator boundaries

`whenFx` consumes `when.query`, then passes the whole `WhenCountSchema` or `WhenRangeSchema` to comparator leaves even though those leaves only use count/range values.

Choose one honest boundary:

- leaf evaluates the whole matching schema and therefore owns query resolution too; or
- leaf is a quantity comparator and accepts only the values it actually owns.

The current middle state is harmless but structurally imprecise.

## 5. Pack tooling result contracts

Several pack Fx return ad hoc `as const` objects rather than schema-backed results, including source collection, JSON reading, and directory packing.

This is lower priority because it is isolated tooling rather than gameplay runtime. Address it after gameplay contract boundaries are stable, using result schemas only where the values are real reusable domain contracts rather than temporary local tuples.

## Recommended order

```text
1. Investigate and decide item versus placement ownership
2. Implement that model before input runtime
3. Add drop 0..1 result schema
4. Derive collection props from owner schemas
5. Tighten when comparator boundaries
6. Review pack tooling result contracts
```
