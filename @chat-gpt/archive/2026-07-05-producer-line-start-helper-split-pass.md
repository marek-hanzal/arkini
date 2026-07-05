# Producer line start helper split pass

Split the producer line start/readiness flow into smaller domain-oriented helpers, using the pinned LLM-friendliness review as the next-work reference. This pass follows the producer completion orchestration split and targets the remaining producer start/readiness mental hotspot.

## Changes

- Kept `src/producer/checkLineStartReadinessFx.ts` as a thin public facade.
- Added `LineStartReadinessTypes.ts` for shared readiness flow types.
- Split line selection/default/visibility/craft-busy checks into `readLineStartSelectionFx.ts`.
- Split producer queue checks into `assertProducerQueueReadyFx.ts`.
- Split line definition lookup into `readLineStartDefinitionFx.ts`.
- Split effect/lock/placement/charge checks into `assertLineStartRuntimeReadinessFx.ts`.
- Split explicit/stored/autofill input checks into `assertLineStartInputsReadyFx.ts`.
- Added `checkLineStartReadinessProgramFx.ts` as the orchestration layer.
- Kept `src/producer/startLineFx.ts` as a thin public facade.
- Added `LineStartExecutionTypes.ts` for start execution flow types.
- Split stored-input readiness into `readProducerStoredInputsReadyFx.ts`.
- Split input preparation into `prepareLineStartInputsFx.ts`.
- Split queued start time calculation into `readQueuedLineStartAtMsFx.ts`.
- Split activated effect creation into `createActivatedLineEffectFx.ts`.
- Split line start event creation into `readLineStartedEventsFx.ts`.
- Split queued producer job creation/write/effect/capacity flow into `startQueuedLineJobFx.ts`.

## Notes

`checkLineStartReadinessFx.ts` dropped from roughly 402 lines to roughly 13 lines.
`startLineFx.ts` dropped from roughly 364 lines to roughly 41 lines.

The behavior is intentionally unchanged. This pass is structural: make producer line start flow easier to inspect before future work on producer bugs, queue behavior, input consumption, runtime constraints, or effect activation.

## Validation

- `npm run format:check`
- `npm run audit:current`
- `npm run audit:dupes`
- `npm run game:schema:check`
- `npm run game:validate -- game/arkini`
- `npm run dc`
- `npm run typecheck`
- Producer-focused Vitest run
- Full Vitest suite verified in four batches because the one-shot run still hangs in this container after many passing files.
- `npm run build`
