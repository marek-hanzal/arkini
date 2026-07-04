# Producer realtime helper split pass

Follow-up deep review pass after producer completion helper split.

## Change

- Split `src/producer/syncRealtimeProducerJobsFx.ts` from a 500+ line mixed queue + job timing + active-effect retiming file into owned pieces:
  - `syncRealtimeProducerJobsFx.ts` now owns producer queue orchestration and draft scope provisioning only.
  - `syncRealtimeProducerJobFx.ts` owns single job delivery/pause/resume/retime/start-gate flow.
  - `syncProducerJobActiveEffectFx.ts` owns active-effect retiming for producer jobs.
  - `ProducerRealtimeQueueHelpers.ts` owns pure queue helpers.
  - `ProducerRealtimeSyncTypes.ts` owns shared sync/queue scope and step types.
- No gameplay behavior change intended.

## Rationale

Producer realtime sync was no longer polluted by local `Context.Tag`, but it still mixed several responsibilities in one mentally expensive file. Keeping queue traversal separate from single-job timing and active-effect retiming makes future timing/effect changes easier to inspect without rebuilding another runtime blob.

## Validation

Run formatting, current audits, schema/config validation, depcruise, typecheck, build, producer/runtime/effects targeted tests, and full `npm run test` where possible.
