# Game save producer validation helper split pass

Commit: see git history for this archive entry

## Why

The newer LLM-friendliness review still listed producer save validation as one of the remaining large production files after producer runtime, world snapshot and item detail cleanup. `src/engine/model/validateGameSaveProducerState.ts` mixed job identity/target validation, active effect validation, active effect job-link validation, producer queue size checks and producer queue ordering checks in one file.

## What changed

`validateGameSaveProducerState.ts` is now a thin orchestration entrypoint.

Extracted helpers:

- `GameSaveProducerValidationTypes.ts`
- `validateSaveProducerJobs.ts`
- `validateSaveActiveEffects.ts`
- `validateProducerJobActiveEffectLinks.ts`
- `validateProducerQueueSizes.ts`
- `validateProducerQueueOrdering.ts`

## Intent

No behavior changes. This is a structural split so future save validation fixes can target one invariant family instead of rereading the entire producer save validation flow.

## Validation

Run checks before committing:

- `npm run format:check`
- `npm run audit:current`
- `npm run audit:dupes`
- `npm run game:schema:check`
- `npm run game:validate -- game/arkini`
- `npm run dc`
- `npm run typecheck`
- focused save/runtime tests
- build/full test blocks as time allows
