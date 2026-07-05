# World snapshot helper split pass

Commit target: split `src/world/validateWorldSnapshotFx.ts` after producer start/readiness cleanup.

## Why

The world snapshot validator was a small runtime invariant hub that mixed check selection, job delivery checks, producer queue checks, active effect checks, replacement safety checks, and producer job fact lookup in one file.

This was still LLM-hostile because changing one check family required scanning every other family in the same file.

## What changed

- Kept `validateWorldSnapshotFx.ts` as the public entrypoint/orchestrator.
- Added `WorldSnapshotValidationScope.ts` for shared scope typing.
- Added `allWorldSnapshotCheckIds.ts` for the default check list.
- Added `readProducerJobFactsByIdFx.ts` for shared producer job lookup.
- Split issue readers by check family:
  - `readWorldSnapshotJobDeliveryIssuesFx.ts`
  - `readWorldSnapshotProducerQueueIssuesFx.ts`
  - `readWorldSnapshotActiveEffectIssuesFx.ts`
  - `readWorldSnapshotReplacementSafetyIssuesFx.ts`
- Added dispatch/orchestration helpers:
  - `readWorldSnapshotCheckIssuesFx.ts`
  - `readWorldSnapshotIssuesFx.ts`

## Notes

Behavior should be unchanged. This pass only moved the existing world snapshot invariant checks into named modules.
