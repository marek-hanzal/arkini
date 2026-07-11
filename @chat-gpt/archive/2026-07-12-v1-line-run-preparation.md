# V1 line-run preparation

Implemented after buffered material delivery and before job runtime.

## Input-run plans

Every implemented input kind now resolves against one explicit runtime snapshot
and optionally produces the exact operation required by one line run.

```text
InputSimpleSchema
→ resolveInputSimpleRunFx
→ InputRunResolutionSchema
  └── InputSimpleRunPlanSchema

InputMaterialSchema + exact buffered runtime items
→ resolveInputMaterialRunFx
→ InputRunResolutionSchema
  └── InputMaterialRunPlanSchema
      └── ordered InputRunItemPlanSchema[]
```

Material allocation preserves runtime item order. One plan identifies the exact
buffered runtime item IDs and quantities that a future job start must consume or
reserve. Missing material produces no plan. Deposit input returns the explicit
`InputRunUnsupportedError` until deposit capacity owns a runtime-state contract.

## Line-run resolution

```text
owner runtime item + line ID + explicit RuntimeSchema snapshot
→ resolveLineRunFx
  ├── readItemLineFx
  ├── lineRulesFx
  ├── resolveLineShowFx
  ├── resolveLineEnableFx
  ├── resolveLineRuntimeFx
  ├── resolveInputRunFx[]
  └── planLineRunFx
→ LineRunResolutionSchema
```

The result exposes final show/enable state, effective runtime, every input
resolution, readiness, and an optional exact `LineRunPlanSchema`.

Visibility remains separate from availability. A hidden line can still be
logically enabled; only enable/disable rules and input readiness determine
whether a run plan exists.

## Snapshot and queue safety

`resolveLineRunFx` requires an explicit immutable `RuntimeSchema` value. Every
nested `when/query` evaluation is locally provided the same snapshot instead of
reading whatever runtime happens to be current later in the Effect graph.

`readLineRunFx` is only a live read/preview wrapper. Its returned plan is not a
write authorization and must never be accepted by a mutation command.

The future `startLineFx` contract must accept identifiers only and execute this
sequence inside one `SynchronizedRef.modifyEffect`:

```text
read current runtime snapshot
→ count current owner jobs / verify maxQueueSize
→ resolveLineRunFx against that same snapshot
→ apply consume/reserve allocation
→ create the job
→ assert complete candidate runtime
→ commit once
```

This is required even in single-threaded JavaScript. Concurrent fibers or two
calls in adjacent event-loop turns can otherwise both preview the same queue
slot and buffered items before either commits. Replanning inside the serialized
store transaction prevents stale-plan double allocation.

## Deferred lifecycle

The next layer owns:

- `JobSchema` and a job-owned location/state contract;
- queue occupancy per line owner;
- atomic `startLineFx`;
- consume removal and reserve relocation;
- completion/cancel return behavior;
- scheduler and `dueAt` processing.

No current write command accepts `LineRunPlanSchema` from a caller.
