# Producer single-job realtime helper split pass

Follow-up pass after tile-engine model split and after the newer LLM-friendliness review still called out `syncRealtimeProducerJobFx.ts` as a remaining producer runtime hot-path candidate.

## Change

- Split `src/producer/syncRealtimeProducerJobFx.ts` from a 335-line single-job realtime sync implementation into a thin dispatcher plus focused helpers:
  - `syncProducerDeliveryCursorFx.ts` owns delivery cursor wake/stop behavior.
  - `readProducerJobSyncStartAtMsFx.ts` owns cheat-speed-aware start cursor calculation.
  - `readProducerStartGateReadyFx.ts` owns start-gate readiness evaluation.
  - `pauseProducerJobFx.ts` owns runtime pause mutation and active-effect retiming.
  - `resumePausedProducerJobFx.ts` owns runtime resume mutation and active-effect retiming.
  - `retimeProducerJobFx.ts` owns effective timing recalculation and mutation.
  - `syncProducerTimingJobFx.ts` owns the running-job gate/retime branch.
  - `readProducerJobSyncState.ts` owns paused vs timing state classification.
- `syncRealtimeProducerJobFx.ts` is now an entrypoint that handles delivery short-circuit, reads the sync start time, and dispatches paused/timing states.
- No gameplay behavior change intended.

## Rationale

Single producer job realtime sync sits on a risky seam: delivery wakeups, pause/resume, start gates, cheat-speed timing, effective timing, queue stopping, and active-effect retiming. Splitting those branches into named helpers makes producer timing bugs easier to route without keeping the whole 300+ line flow in working memory.

## Validation

- `npm run format:check`
- `npm run audit:current`
- `npm run audit:dupes`
- `npm run game:schema:check`
- `npm run game:validate -- game/arkini`
- `npm run dc`
- `npm run typecheck`
- Targeted producer/realtime tests passed (`applyGameActionProducerFx.grants`, `queue`, `start`, `runGameTickFx`, `realtimeProducerEffects`).
- Full one-shot Vitest still times out before final summary in this container after many tests pass; this is the same runner behavior seen in prior passes, not a code failure observed in this change.
- `npm run build`
