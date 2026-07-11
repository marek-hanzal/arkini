# V1 schema contract follow-ups

Audit performed after query, when, drop, output, and standalone line-rule evaluation were implemented.

## Completed contract cleanup

- Immutable `GameConfigSchema` was removed from mutable `RuntimeSchema`; config remains owned by `GameConfigFx`.
- Every query/when/rule/output `origin` contract was narrowed from `RuntimeItemSchema` to `PositionSchema`.
- Drop-rule evaluators return neutral schema-backed rule results; only `dropFx` interprets enable gates and disable vetoes.
- `LocationSchema` owns concrete `scope + position`, and runtime/state items own their location directly.
- Runtime and state use matching flat item collections; board and inventory are derived views.
- Public runtime access is read-only and dedicated atomic commands own every mutation.
- Explicit runtime checkers validate IDs, scope, bounds, and location occupancy before hydration or command commit.
- One configured drop resolves through `DropResolutionSchema` to either one `DropResultSchema` value or `undefined`; collection composition remains owned by `outputFx`.
- Weighted-selector props are derived from their owner schemas instead of manually restating tuple contracts.
- `whenCountFx` and `whenRangeFx` accept only the schema fields they compare after `whenFx` has resolved the query.

Full item/location decision record: `@chat-gpt/archive/2026-07-11-v1-item-owned-location-runtime.md`.

## Remaining: pack tooling result contracts

Several pack Fx return ad hoc `as const` objects rather than schema-backed results, including source collection, JSON reading, and directory packing.

This is intentionally deferred. These values are isolated tooling internals rather than gameplay runtime contracts. Add result schemas only when a value becomes a real reusable boundary that other code needs to reference; do not manufacture schemas for temporary local tuples merely for stylistic uniformity.
