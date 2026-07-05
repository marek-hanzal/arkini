# GameSave schema helper split pass

## Commit goal

Make `GameSaveSchema.ts` LLM-friendly by separating the save shape contract from cross-config validation domains without changing public imports or save behavior.

## Changes

- Kept `src/engine/model/GameSaveSchema.ts` as the public facade for existing imports.
- Moved the raw save Zod shape and inferred save types into `GameSaveShapeSchema.ts`.
- Split config-aware validation into domain files:
  - identity/shape
  - board state
  - inventory state
  - producer jobs/effects/queue state
  - line state
  - producer inputs
  - craft jobs/inputs
  - producer charges
  - item capacities
  - board memory layouts
  - item spawn jobs/dependency cycles
- Added shared validation issue/context and reader helpers.
- Avoided schema/validator circular imports by making validators depend on the shape schema, while the public facade composes shape + config validation.

## Validation notes

- `GameSaveSchema.ts` dropped from ~1734 lines to a small facade.
- `GameSaveShapeSchema.ts` owns structural Zod parsing and type inference.
- `validateGameSaveAgainstConfig.ts` owns only orchestration.
- Dependency cruiser reported no circular dependency violations after the split.

## Commands run

- `npm run format:check`
- `npm run audit:current`
- `npm run audit:dupes`
- `npm run game:schema:check`
- `npm run game:validate -- game/arkini`
- `npm run dc`
- `npm run typecheck`
- targeted save/runtime/storage tests
- `npm run test` under a timeout wrapper, exited 0 after reporting 102 files / 622 tests passed
- `npm run build`
