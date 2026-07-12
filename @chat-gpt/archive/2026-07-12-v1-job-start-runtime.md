# V1 active jobs and atomic line starts

Implemented after the completed-game compiler pass.

## Runtime and state model

Runtime and persisted state now share one active-job collection:

```text
RuntimeSchema / StateSchema
├── items[]
└── jobs[]
```

`JobSchema` owns:

- stable job ID;
- job revision;
- owner runtime item ID;
- canonical line ID;
- start timestamp;
- due timestamp.

Jobs do not embed canonical line config or a stale line-run plan. Completion must resolve the immutable line again through the owner item and `lineId`.

## Reserved material location

Reserved input material remains a normal runtime item and owns one `JobLocationSchema`:

```text
jobId
returnLocation: InputLocationSchema
```

The return location is the input buffer, not the original grid location. A reservation therefore becomes unavailable to later line-run planning while still occupying the capacity of the input slot it will return to.

Input capacity checks and material delivery count both:

- currently buffered input items;
- active job-reserved items returning to that slot.

## Atomic start flow

`startLineFx` accepts only `ownerItemId` and `lineId`.

Inside one `modifyRuntimeFx` transaction it performs:

```text
locked current runtime
→ resolveLineRunFx against that exact snapshot
→ assert owner queue capacity
→ create job identity and timestamps
→ apply every consume/reserve input operation
→ append the active job
→ runtime invariant validation
→ one commit
```

A caller may use `readLineRunFx` for preview, but no write command accepts its plan. The start command always recomputes the plan inside the serialized transaction.

## Input application

- `simple` is an explicit no-op.
- `consume` removes a fully allocated item or revises a partially consumed stack.
- `reserve` moves a fully allocated item to its job location or splits a partial allocation into source remainder plus a new reserved runtime item.
- every mutation of an existing item receives a fresh revision.

## Queue policy

- producer: configured `maxQueueSize`;
- craft: one active job;
- stash: one active job.

Queue occupancy is counted per owner item across all of its lines.

Parallel starts are serialized through the existing runtime transaction boundary. Each start resolves queue and input state after all earlier committed starts, so jobs cannot share one queue slot or one material allocation.

## Runtime invariants

The explicit runtime checker now reports:

- duplicate job IDs;
- missing job owners;
- active job owner outside a grid;
- missing owner lines;
- queue overflow;
- due timestamp before start timestamp;
- job-reserved item referencing a missing job;
- reservation returning to an input owned by a different owner/line.

An active job owner must stay on a grid so future completion has a concrete output origin. Generic removal or storing of that owner fails at the candidate-runtime assertion boundary.

## Deferred lifecycle

This pass intentionally does not implement:

- job completion;
- due-job scheduling;
- cancellation and reserved-material return;
- pause/resume;
- craft or stash owner consumption;
- deposit input capacity.

The next natural layer is `completeJobFx`, followed by due-job orchestration and cancellation.
