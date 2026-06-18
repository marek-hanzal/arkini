# v0 producer queue size

Status: DONE
Date: 2026-06-18

## Goal

Make producer automation bounded. A producer may queue jobs sequentially, but it must never accept unbounded future work for a single producer instance.

## Result

- `producers.*.maxQueueSize` is now required in the canonical game config schema.
- Every authored Arkini producer currently has `maxQueueSize: 1`, so base producers can run one job at a time and cannot be preloaded with an infinite backlog.
- `checkProducerProductStartReadinessFx` rejects `producer.product.start` with `producer_queue_full` when active/queued jobs for the producer item instance reach the effective limit.
- The existing sequential job scheduling remains: when the limit allows more than one job, new jobs start after the previous job completes instead of running in parallel.
- `producer.maxQueueSize.add` is now an upgrade effect. It flows through `buildConfigLayerFx` / `applyConfigLayerFx`, clamps effective queue size to at least `1`, and applies to future action readiness/dispatch through the existing effective `GameConfig` path.
- `RuntimeGameEngineAdapter.readSnapshot().config` now publishes the effective config for the current save, so UI views see completed upgrade effects instead of stale base config. The adapter still keeps `adapter.config` as the immutable base config for engine actions/hash/storage.
- Producer product line view exposes `producerQueuedJobs`, `queueSize`, and `queueFull`.
- Item sheet product lines show `Queue x/y`; no-input start buttons disable with `Queue full` when capped.
- Upgrade list can describe producer queue effects.

## Tests added / updated

- Starting a second job succeeds only when `maxQueueSize` is raised.
- Default queue size `1` rejects a second producer start with `producer_queue_full`.
- Readiness returns `producer_queue_full` without mutating save.
- A completed queue-size upgrade raises the effective queue cap for future product starts.

## Watchouts

- Queue size is per producer item instance, not per product line. `queuedJobs` in product-line view remains line-specific; `producerQueuedJobs` is the global queue occupancy for that producer tile.
- Jobs that already exist in save count toward the cap until the tick engine processes their completion and removes them. Runtime normally schedules ticks through `nextWakeAtMs`; do not special-case completed-but-unprocessed jobs inside readiness unless the action dispatch flow starts ticking before every command.
- Keep this in the engine/config layer. Do not implement queue policy in React only; UI is just a display layer for the engine invariant.
