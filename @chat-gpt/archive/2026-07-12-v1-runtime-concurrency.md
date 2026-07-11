# V1 runtime concurrency model

Implemented after line-run preparation and before job runtime.

## One transaction gateway

Every production write entrypoint under `src/v1/**/write` must use
`modifyRuntimeFx`. It is the only module allowed to call
`SynchronizedRef.modifyEffect`.

```text
latest RuntimeSchema snapshot
→ resolve / plan against that exact snapshot
→ apply to an immutable candidate runtime
→ assertRuntimeFx(candidate)
→ commit once
```

`modifyRuntimeFx` locally provides `RuntimeFx` with the locked snapshot. Nested
query, when, rule, and resolver effects therefore cannot accidentally read a
newer or older store value while one transaction is being planned.

A static architecture test enforces:

- no direct runtime-store imports outside the internal boundary;
- no direct `SynchronizedRef.modifyEffect` outside `modifyRuntimeFx`;
- every write entrypoint owns the transaction boundary;
- write entrypoints do not import state-derived plans/results;
- writes targeting previously observed mutable entities use a revision guard or
  are explicitly classified as snapshot-resolved commands.

## Two valid write-command categories

### Snapshot-resolved commands

These accept durable intent/configuration and recompute every state-dependent
decision inside `modifyRuntimeFx`:

- `spawnItemFx`
- `startFx`
- `placeDropFx`
- `placeOutputFx`

Placement writes accept `DropSchema` / `OutputSchema`, not pre-resolved
`DropResultSchema` / `OutputResultSchema`. Rules, chance, quantity, placement
planning, and the final mutation all observe the same locked snapshot.

### Entity-intent commands

These target mutable entities that a caller previously read:

- `moveItemFx`
- `removeItemFx`
- `setItemQuantityFx`
- `swapItemsFx`
- `storeInputMaterialFx`

Every mutable runtime item owns an opaque persisted `revision` generated from
CUID2. The caller sends the revision it observed. The command compares it inside
the same transaction and fails with `RevisionConflictError` when stale.

Every successful mutation of an existing item creates a fresh revision. Every
new item receives its initial revision through `createRuntimeItemFx`.

A revision is an optimistic-concurrency token, not a transaction/command ID.
A future command ID may be added for idempotent transport retries, but it must
not replace entity revisions: those solve different problems.

## Granularity

Revisions are per mutable entity, not global runtime versions. Unrelated writes
must not conflict merely because some other item changed.

Aggregate state such as queue occupancy, free locations, buffered capacity, and
output rules is always recomputed from the latest locked runtime snapshot. It
does not use externally supplied expected counters or plans.

## Future job commands

`startLineFx`, completion, cancellation, queue mutation, consume, and reserve
must follow the same model:

```text
identifiers / durable intent only
→ modifyRuntimeFx
→ current queue + current buffered items
→ resolveLineRunFx against the locked snapshot
→ apply consume / reserve / job changes
→ validate candidate runtime
→ commit once
```

No job write may accept `LineRunPlanSchema` created by a preview read.
