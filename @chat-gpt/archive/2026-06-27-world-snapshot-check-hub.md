# World snapshot check hub

Implemented a centralized read-only runtime snapshot layer under `src/v0/game/world`.

What moved into the hub:

- producer queue status normalization (`queued`, `running`, `ready`, `paused`, `delivery_blocked`, `blocked_by_paused_queue_head`)
- active effect status normalization (`active`, `scheduled`, `expired`, `producer_paused`, `blocked_by_paused_queue_head`, source/scope inactive states)
- requirement facts for passive/stored/proximity requirements
- wake plan facts with concrete wake reasons
- shared post-action/tick world processing pipeline
- selected snapshot validation issues for producer queues, active effects, and replacement safety

Runtime integration:

- `applyGameActionFx` and `runGameTickFx` now use `processWorldSnapshotFx` instead of duplicating job processing order.
- `readNextWakeAtMsFx` delegates to `readWorldWakePlanFx`.
- `readGameEffectSourceInstances` delegates active-effect applicability to world active effect facts.
- `processExpiredActiveEffectsFx` delegates paused/blocked linked-effect semantics to world active effect facts.
- `readProducerJobRequirementsReadyFx` delegates requirement readiness to producer requirement facts.
- `RuntimeGameEngineAdapter.validateSnapshot()` exposes live snapshot validation without mutating save state.

This is intentionally not a replacement for `GameConfigSchema` / `GameSaveConfigSchema`. It is the live runtime truth/reporting layer for `(config, save, nowMs)`.
