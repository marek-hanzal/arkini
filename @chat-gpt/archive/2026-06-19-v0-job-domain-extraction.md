# v0 job domain extraction

Moved delayed/retry gameplay helpers out of `src/v0/game/engine/fx` into top-level `src/v0/game/job`.

Moved files:

- `compareGameTimedJobs.ts`
- `compareItemSpawnJobs.ts`
- `createGameJobIdFx.ts`
- `createGameItemSpawnJobIdFx.ts`
- `createItemSpawnJobsFx.ts`
- `processItemSpawnJobFx.ts`
- `processItemSpawnJobsFx.ts`
- `processItemSpawnJobsFx.test.ts`
- `readDueItemSpawnJobsFx.ts`
- `readNextWakeAtMsFx.ts`

Rationale: delayed, blocked, retrying, or future work is a job domain. `engine` may tick/orchestrate jobs, but it should not own job-family implementation helpers just because they return `Effect`.

Behavior intentionally unchanged.
