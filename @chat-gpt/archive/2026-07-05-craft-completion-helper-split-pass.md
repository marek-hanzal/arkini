# Craft completion helper split pass

## Context

After producer completion/realtime and board-memory helper splits, `src/craft/completeCraftJobFx.ts` was the next lowest-risk runtime orchestration blob. It still owned event/result construction, target/recipe validation, blocked retry/fail handling, board capacity/storage checks, and final replacement in one file.

## Changes

- Split craft completion events/results into `src/craft/CraftJobCompletionEvents.ts`.
- Split shared scope/target types into `src/craft/CraftJobCompletionTypes.ts`.
- Split recipe/target validation into `src/craft/readCraftCompletionTargetFx.ts`.
- Split board storage/capacity blocking into `src/craft/readCraftCompletionBlockedReasonFx.ts`.
- Split blocked retry/fail handling into `src/craft/completeBlockedCraftJobFx.ts`.
- Split result replacement into `src/craft/applyCraftCompletionResultFx.ts`.
- Reduced `src/craft/completeCraftJobFx.ts` to the live-job orchestration edge.
- Removed the old duplicate `save: nextSave` property from the failed craft completion result while moving the factory.

## Validation

- `npm run format:check`
- `npm run audit:current`
- `npm run audit:optional`
- `npm run game:schema:check`
- `npm run game:validate -- game/arkini`
- `npm run dc`
- `npm run typecheck`
- `npm run build`
- Relevant craft/runtime tests.
