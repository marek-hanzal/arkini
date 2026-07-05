# 2026-07-05 Game event schema family split pass

## Commit intent

Split `src/event/GameEventSchema.ts` by event family so the public event type entrypoint is a small event-family map instead of a single 361-line discriminated union blob.

## What changed

- `GameEventSchema.ts` now imports family schemas and assembles the discriminated union.
- Shared base schemas moved to `GameEventBaseSchemas.ts`.
- Item lifecycle events moved to `GameItemLifecycleEventSchemas.ts`.
- Producer line/input events moved to `GameProducerEventSchemas.ts`.
- Craft events moved to `GameCraftEventSchemas.ts`.
- Effect events moved to `GameEffectEventSchemas.ts`.
- Board memory events moved to `GameBoardMemoryEventSchemas.ts`.
- Cheat events moved to `GameCheatEventSchemas.ts`.

## Notes

- `GameItemCreatedReasonSchema` remains re-exported from `GameEventSchema.ts` for existing save-shape imports.
- No behavioral schema change was intended. The previous duplicate `producerJobId` key in the `effect.expired` object literal collapsed to the same runtime schema shape as a single optional key.
- This aligns the schema structure with visual/audio planner event-family splits.

## Validation

- `npm run format:check`
- `npm run audit:current`
- `npm run audit:dupes`
- `npm run game:schema:check`
- `npm run game:validate -- game/arkini`
- `npm run dc`
- `npm run typecheck`
- `npm run build`
- Full Vitest suite verified in small blocks: 107 files / 622 tests passed.
