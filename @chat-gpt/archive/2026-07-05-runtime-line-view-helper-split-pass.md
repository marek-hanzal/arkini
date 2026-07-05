# Runtime line view helper split pass

## Context

`src/play/game-engine-bridge/readRuntimeLineViewsFromGameSave.ts` was still a large UI/runtime bridge file. It combined producer queue state, visible/queued line inclusion, default line selection, timing state, input availability, effect requirement rendering, effect benefit lines, output target limits, and final `LineView` assembly in one place.

## Changes

- Reduced `readRuntimeLineViewsFromGameSave.ts` to a thin orchestrator that reads queue state, visible line ids, default selection, and assembles per-line views.
- Split producer queue view state into `readRuntimeProducerQueueViewState.ts`.
- Split visible-or-queued line filtering into `readLineIdsVisibleOrCurrentlyQueued.ts`.
- Split default line selection and selected-default checks into `readRuntimeLineDefaultSelection.ts` and `readRuntimeLineIsSelectedDefault.ts`.
- Split per-line jobs, timing, stored inputs, input view state, effect requirement view state, effect benefit labels, start requirement state, and target limit state into focused bridge helpers.
- Moved the full per-line `LineView` assembly into `readRuntimeLineViewFromDefinition.ts` so the public reader no longer owns every small read-model detail directly.

## Validation

- `npm run format:check`
- `npm run audit:current`
- `npm run audit:dupes`
- `npm run game:schema:check`
- `npm run game:validate -- game/arkini`
- `npm run dc`
- `npm run typecheck`
- `npx vitest run --no-color src/play/game-engine-bridge/readRuntimeLineViewsFromGameSave.test.ts`
- `npm run test`
- `npm run build`
