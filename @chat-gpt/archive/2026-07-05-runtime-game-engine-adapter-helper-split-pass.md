# Runtime game engine adapter helper split pass

## Commit

TBD

## Why

The latest review still listed `src/engine/runtime/RuntimeGameEngineAdapter.ts` as one of the largest remaining production integration hubs after the producer, world snapshot, item detail and producer test splits.

The adapter was not conceptually broken, but it mixed too many runtime responsibilities in one class file:

- bootstrapping config/save/initial realtime sync,
- mutation queueing,
- catch-up tick loops,
- readiness dispatch,
- action dispatch with catch-up result publishing,
- save replacement,
- manual ticks,
- world snapshot validation,
- result storage/listener publish helpers.

For LLM work this is exactly the kind of adapter that becomes "everything between everything".

## Change

`RuntimeGameEngineAdapter.ts` was reduced from roughly 418 lines to roughly 156 lines.

Extracted helpers:

- `RuntimeGameEngineAdapterTypes.ts`
- `RuntimeGameEngineAdapterScope.ts`
- `readInitialRuntimeGameEngineAdapterOptions.ts`
- `catchUpDueRuntimeGameTicks.ts`
- `combineGameEngineResults.ts`
- `readRuntimeActionReadiness.ts`
- `dispatchRuntimeGameAction.ts`
- `replaceRuntimeGameSave.ts`
- `tickRuntimeGameEngine.ts`
- `validateRuntimeWorldSnapshot.ts`

The public `RuntimeGameEngineAdapter` class remains the entrypoint and keeps its public namespace-compatible prop types.

## Notes

No behavior change intended. The class now owns state/listeners/queueing and delegates runtime operations to named helpers. This makes action dispatch, catch-up ticks, replacement sync and snapshot validation individually greppable without turning the adapter into a dependency octopus.

## Validation

- `npm run format:check`
- `npm run audit:current`
- `npm run audit:dupes`
- `npm run game:schema:check`
- `npm run game:validate -- game/arkini`
- `npm run dc`
- `npm run typecheck`
- targeted runtime/store/world tests: 36/36
- full test suite verified in smaller blocks: 107 files / 622 tests
- `npm run build`
