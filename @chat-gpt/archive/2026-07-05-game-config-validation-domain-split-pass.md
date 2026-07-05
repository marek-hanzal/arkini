# Game config validation domain split pass

Split the previously monolithic `src/config/validation/GameConfigValidation.ts` into domain-oriented validation modules while preserving the public `validateGameConfig` entrypoint.

## Changes

- Kept `GameConfigValidation.ts` as a thin orchestration facade.
- Added shared validation primitives in `GameConfigValidationCommon.ts`.
- Added config readers in `GameConfigValidationReaders.ts`.
- Split selector validation into `GameConfigSelectorValidation.ts`.
- Split effect/drop-output validation into `GameConfigEffectValidation.ts` and `validateGameConfigActivationOutput.ts`.
- Split item definition/capability validation into `validateGameConfigDefinitionReferences.ts` and `validateGameConfigCapabilities.ts`.
- Split starting state validation into `validateGameConfigStartingState.ts`.
- Split blueprint dependency cycle validation into `validateBlueprintDependencyCycles.ts`.
- Split gameplay soft-lock validation into `validateGameplaySoftLockRisks.ts`.
- Added formatting helpers in `GameConfigValidationFormatting.ts`.

## Notes

The main file dropped from roughly 3540 lines to roughly 35 lines. The largest remaining validation module is gameplay soft-lock validation; it is intentionally left as the next likely config-validation cleanup target because it contains several cohesive subdomains: source creation, reachability solving, requirement checks, contradiction checks, and unreachable-target formatting.

## Validation

- `npm run format:check`
- `npm run audit:current`
- `npm run audit:dupes`
- `npm run game:schema:check`
- `npm run game:validate -- game/arkini`
- `npm run dc`
- `npm run typecheck`
- `npm run build`
- Vitest suite verified in smaller batches because the one-shot run still hangs in this container after passing many files.
