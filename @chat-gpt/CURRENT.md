# Current project memory

This file contains durable non-obvious decisions and the exact continuation pointer. Root documentation owns the full architecture and code contracts.

## Current implementation task

**Task 03 — Stash lifecycle**

Status: **Ready**

Read:

1. `tasks/README.md`;
2. `tasks/03-stash-lifecycle.md`;
3. the stash and completion rows in `tasks/COVERAGE.md`;
4. current completion, output, placement, removal, max-count reservation, state, Tick, and runtime code;
5. only the historical files named by task 03.

Next action:

> Compare historical stash owner consumption and top-level output with the explicit `completeStashJobRuntimeFx` branch, then return the smallest lifecycle design that preserves deterministic output, atomic owner removal, buffered-input release, reservation return, and blocked retry. Surface any `line.output` versus top-level `output` schema ambiguity before changing a schema.

Do not fold stash behavior into producer or blueprint completion. Shared removal and placement primitives are already available; lifecycle order remains owner-specific.

## Absolute code rules

- Named project operations are Effect programs and use `*Fx` without “pure helper” exceptions.
- Every exact identifier uses `IdSchema`; never create `ItemIdSchema`, `LineIdSchema`, `JobIdSchema`, `AssetIdSchema`, or similar wrappers.
- One concept per file; no barrels, helper piles, or generic junk-drawer domains.
- Production writes enter through `modifyRuntimeFx` and build immutable validated candidates.
- The engine is standalone; UI is a thin presentation adapter.
- Configuration schemas are stable. Do not change a schema shape or contract without first surfacing and agreeing on the exact need.

## Runtime and session

- One canonical committed transition owns runtime plus transient events.
- Mutation planning is serialized and interruptible.
- STM owns accepted commit and subscription registration.
- `getSnapshot()` reads the canonical runtime directly.
- Listener subscriptions are current-plus-tail, listener-specific, scoped, and cancellation-safe.
- Runtime callbacks, event callbacks, save reporting, and Tick reporting accept `void | PromiseLike<void>` and are failure-isolated.
- Duplicate saves are acceptable.
- UI animation intentionally lags runtime and may be redirected by later events.

## Tick, jobs, queue, and completion

- Fixed simulation step: 200 ms.
- Production time source: Effect Clock.
- Tick adapter time is session-only and never persisted.
- Jobs store only `durationMs` and `remainingMs`.
- One active job per owner; queued requests are FIFO and are not jobs.
- Filling inputs never starts work; starting is explicit.
- Inventory is a hard pause.
- Started jobs cannot be cancelled.
- Queue-only owners remain valid and are retried at fixed-step boundaries.
- Shared completion facts are resolved once, then dispatched to explicit producer, craft, blueprint, or stash branches.
- Active jobs reserve the worst-case future quantity of every possible output against canonical `maxCount`. Quantity ranges reserve their maximum, chance rolls reserve success, weighted rolls reserve repeatable worst candidates, and alternative roll sets reserve the per-item maximum. Queued requests reserve nothing until authoritative dispatch.
- Ordinary placement, direct spawn, and direct quantity replacement respect active-job output reservations. Completion removes its own job before materializing output, so it spends rather than duplicates its reservation.
- Runtime purity is a composable boolean. Line input/job/queue state makes a line non-pure; an item is pure only when all owned lines and item state are pure. Generic stack and quantity mutation require purity inside the same runtime draft.
- A pure item uses configured `maxStackSize`; an impure item has effective stack size `1`. Any write that would attach identity-bound state to quantity greater than `1` must isolate the original board identity at quantity `1` and standard-place the pure remainder inside the same candidate. Inventory is passive and accepts no new state attachment.
- A zero-capacity material input is closed during its active line job; positive capacity remains open storage. Craft authoring fixes every material capacity to zero.
- Input storage and generic line start share the canonical stateful-owner isolation path. A start resolves against the pre-command world, attaches its job and input state in the candidate, then isolates one owner quantity; craft completion consumes only that isolated owner, supports an optional resolved replacement, and places output before returning reservations.
- Blueprint completion creates a new target identity at the exact owner cell, places top-level by-products, removes all state bound to the blueprint identity, and returns reservations last. Any failure rolls back the entire completion.

## Reservations and removal

- Reserved material is always returned through standard drop placement.
- Never retain original instance ID, stack, slot, source item, or historical position for return.
- Generic mutations reject job-scoped items.
- Completion is all-or-nothing.
- An owner with active or queued work cannot be permanently removed through the public command.
- Shared runtime removal releases buffered inputs, removes the owner, and discards queued work bound to the removed identity. Owner-specific completion may use it only after detaching its completed active job.

## Randomness

- Completion randomness is deterministic from stable job identity plus explicit algorithm version.
- Tick time, wall clock, and job revision are not seed inputs.
- Blocked completion retries must preserve the same random outcome.

## Configuration

- Authoring uses recursive JSON fragments and PNG resources.
- Compiler, validator, tests, and packer share one completed-config compiler.
- Duplicate providers and record IDs are diagnostics; later files never overwrite silently.
- Blueprint visuals are explicit `[blueprintAssetId, targetAssetId]` tuples and may intentionally share the blueprint asset.

## Migration policy

- Historical source is a behavioral oracle, never an architectural donor.
- Follow the numbered queue in `tasks/README.md`.
- Update `tasks/COVERAGE.md` and prune historical source after every completed slice.
- Do not repeatedly inspect areas marked **Superseded**, **Rejected**, or **Removed** unless a current task names a concrete unresolved behavior.
