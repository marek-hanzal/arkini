# Current project memory

This file contains durable non-obvious decisions. Root documentation owns the full contracts.

## Absolute code rules

- Named project operations are Effect programs and use `*Fx` without “pure helper” exceptions.
- Every exact identifier uses `IdSchema`; never create `ItemIdSchema`, `LineIdSchema`, `JobIdSchema`, `AssetIdSchema`, or similar wrappers.
- One concept per file; no barrels, helper piles, or generic junk-drawer domains.
- Production writes enter through `modifyRuntimeFx` and build immutable validated candidates.
- The engine is standalone; UI is a thin presentation adapter.

## Runtime and session

- One canonical committed transition owns runtime plus transient events.
- Mutation planning is serialized and interruptible.
- STM owns accepted commit and subscription registration.
- `getSnapshot()` reads the canonical runtime directly.
- Listener subscriptions are current-plus-tail, listener-specific, scoped, and cancellation-safe.
- Runtime callbacks, event callbacks, save reporting, and Tick reporting accept `void | PromiseLike<void>` and are failure-isolated.
- Duplicate saves are acceptable.
- UI animation intentionally lags runtime and may be redirected by later events.

## Tick, jobs, and queue

- Fixed simulation step: 200 ms.
- Production time source: Effect Clock.
- Tick adapter time is session-only and never persisted.
- Jobs store only `durationMs` and `remainingMs`.
- One active job per owner; queued requests are FIFO and are not jobs.
- Filling inputs never starts work.
- Starting is explicit.
- Inventory is a hard pause.
- Started jobs cannot be cancelled.
- Queue-only owners remain valid and are retried at fixed-step boundaries.

## Reservations and removal

- Reserved material is always returned through standard drop placement.
- Never retain original instance ID, stack, slot, source item, or historical position for return.
- Generic mutations reject job-scoped items.
- Completion is reservation release + output placement + job removal, all-or-nothing.
- An owner with active or queued work cannot be permanently removed.
- Removing an idle owner releases buffered inputs through ordinary placement in the same atomic mutation.

## Randomness

- Completion randomness is deterministic from stable job identity plus explicit algorithm version.
- Tick time, wall clock, and job revision are not seed inputs.
- Blocked completion retries must preserve the same random outcome.

## Configuration

- Authoring uses recursive JSON fragments and PNG resources.
- Compiler, validator, tests, and packer share one completed-config compiler.
- Duplicate providers and record IDs are diagnostics; later files never overwrite silently.
- Blueprint visuals are explicit `[blueprintAssetId, targetAssetId]` tuples and may intentionally share the blueprint asset.

## Current task state

No active architecture migration or review cleanup remains at this snapshot. Continue feature work from the current source unless `tasks/README.md` states otherwise.
