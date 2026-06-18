# V0 generated entity IDs

Date: 2026-06-18
T7 was redirected after Marek clarified that generated IDs do not need to be predictable. The engine no longer needs to carry mutable save-level counters just so it can issue `item-instance:2`, `job:1` and `scheduled-event:1` like a tiny municipal office with worse UX.

## Decision

Runtime-created game entity IDs use `genId`/cuid2 through a small helper:

- `createGameItemInstanceId()` -> `item-instance:${genId()}`
- `createGameJobId()` -> `job:${genId()}`
- `createGameScheduledEventId()` -> `scheduled-event:${genId()}`

The prefixes stay because debugging naked cuid strings is a sport for people who hate themselves.

## Save model change

Removed these fields from `GameSaveSchema`:

- `nextItemInstanceIndex`
- `nextJobIndex`
- `nextScheduledEventIndex`

`GameSaveConfigSchema` still validates record-key/id consistency, uniqueness and references through the existing checks. It does not validate monotonic counters because there are no counters left. If cuid2 collides, the universe has already escalated beyond the pay grade of a Zod refinement.

## Important implementation note

Initial board items still use deterministic bootstrap IDs (`item-instance:1`, `item-instance:2`, ...). They are authored from `startingState`, not generated during gameplay, and keeping them stable avoids rewriting every scenario/test assumption while the runtime-created entities move to `genId`.

If we later want all bootstrap IDs random too, do it as a separate test/scenario cleanup. Do not smuggle that into a gameplay stabilization task unless boredom has become a design requirement.

## Test policy

Tests that exercise runtime-generated IDs should not assert exact values like `job:1`. They should capture IDs from records/events or assert by semantic fields (`productId`, `startedAtMs`, `outputTableId`, board coordinates, etc.). Manual fixtures may still use explicit fixed IDs when they are authored test data.

## Files touched

- `src/v0/game/engine/logic/createGameEntityId.ts`
- `src/v0/game/engine/fx/createGameItemInstanceIdFx.ts`
- `src/v0/game/engine/fx/createGameJobIdFx.ts`
- `src/v0/game/engine/fx/createGameScheduledEventIdFx.ts`
- `src/v0/game/engine/model/GameSaveSchema.ts`
- `src/v0/game/engine/fx/createInitialGameSaveFx.ts`
- tests that previously asserted generated counter IDs

## Follow-up

Next stabilization task remains event flow cleanup / visual planner hardening, unless a fresh gameplay regression screams louder.
