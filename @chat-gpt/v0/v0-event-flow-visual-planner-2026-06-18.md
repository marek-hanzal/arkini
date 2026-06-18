# v0 event flow visual planner cleanup - 2026-06-18

## Summary

Stabilization epic T8 is implemented. Runtime visual effects no longer translate engine domain events into a separate `ActionVisualEvent` language. `GameRuntimeVisualEffects` now consumes `GameEvent[]` directly and builds a concrete `GameEngineVisualPlan`.

This removes the old three-language chain:

`GameEvent -> ActionVisualEvent -> TileEngine motion`

and replaces it with:

`GameEvent -> GameEngineVisualPlan -> TileEngine motion/transients`

The plan output is not a new event stream. It is adapter instructions: board enter requests, inventory enter requests and board transient tile plans.

## Files added

- `src/v0/play/game-engine-visual/GameVisualMotion.ts`
  - small internal motion descriptor and timing constants for the planner
- `src/v0/play/game-engine-visual/gameVisualMotionSettlementDelayMs.ts`
- `src/v0/play/game-engine-visual/toTileEngineEnterMotion.ts`
- `src/v0/play/game-engine-visual/toTileEngineExitMotion.ts`
- `src/v0/play/game-engine-visual/GameEngineVisualPlan.ts`
- `src/v0/play/game-engine-visual/createGameEngineVisualPlan.ts`
- `src/v0/play/game-engine-visual/applyGameEngineVisualPlan.ts`
- `src/v0/play/game-engine-visual/summarizeGameEngineVisualPlan.ts`
- tests for plan creation and application

## Files removed

Removed the old visual event dialect and mapper:

- `src/v0/play/action/ActionVisualAnimation*`
- `src/v0/play/action/ActionVisualEvent*`
- `src/v0/play/game-engine-bridge/createActionVisualEventsFromGame*`
- `src/v0/play/visual-events/*`
- `src/v0/play/tile-engine-motion/*`

`src/v0/play/action/GameActionError.ts` and `toGameActionError.ts` stay. They are action error helpers, not visual event plumbing.

## Behavioral notes

Currently planned visuals:

- `item.created` to board -> sequenced board enter motion.
- `item.created` to inventory -> explicit no-motion; runtime snapshot updates quantity/state.
- `item.consumed` with `merge-source` plus following `item.replaced` with `merge-result` -> one merge visual plan with board exit transients and target merge-in.
- `item.replaced` with `craft-result` -> replacement crossfade with old-item transient and target replace-in.

Other domain events are explicitly accounted for as no-motion in the planner switch. New `GameEvent` union variants should fail the planner exhaustiveness check until they are handled or explicitly marked no-motion. No silent visual bridge fallthrough, no second event citizenship.

## Why this shape

The engine domain event stream stays the canonical event language. TileEngine remains generic and only receives motion requests/transient tiles. `GameEngineVisualPlan` is an adapter output, not a domain model and not another gameplay event schema.

This is deliberately less cute than a generic event bus. Cute code is how bugs learn to wear perfume.

## Validation

Passed:

- `npm run format:check` (known warning: large generated `game/arkini.assets.json`)
- `npm run typecheck`
- `npm run test`
- `npm run game:validate -- game/arkini`
- `npm run game:validate -- game/arkini.game.json game/arkini.assets.json`
- `npm run dc`
- `npm run build` (known Vite chunk warning)
