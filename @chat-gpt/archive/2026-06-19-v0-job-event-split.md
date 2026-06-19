# V0 job/event split

Status: done on 2026-06-19.

## Decision

- Job: anything planned for future processing. If it has `dueAtMs`, `completesAtMs`, `retryAtMs`, progress, blocking, or rescheduling, it is a job.
- Event: concrete occurrence processed now and emitted through the standard `GameEvent` result stream.

Hard rule: no pending/scheduled events. Pending/scheduled means job. Event means now.

## Code result

- `GameSave.scheduledEvents` became `GameSave.itemSpawnJobs`.
- `GameSaveScheduledEventSchema` became `GameSaveItemSpawnJobSchema`.
- Scheduled-event helpers became item-spawn job helpers:
  - `processItemSpawnJobsFx`
  - `processItemSpawnJobFx`
  - `readDueItemSpawnJobsFx`
  - `createItemSpawnJobsFx`
  - `compareItemSpawnJobs`
  - `createGameItemSpawnJobIdFx`
- `GameEvent` remains the output stream for things that happened now.
- `item.spawn.blocked` now references `jobId`, not `scheduledEventId`.
- `runGameTickFx` treats item-spawn jobs as one job family before producer/craft/upgrade jobs.
- Producer completion no longer calls item-spawn job processing internally; producer output delivery is owned by `producerJobs.delivery`.

## Guardrails

- Do not reintroduce a pending/scheduled event queue.
- Future delayed gameplay should be modeled as a job map or an explicit job subtype.
- Visual sequencing should stay outside persistent save state unless explicitly designed as a job.
