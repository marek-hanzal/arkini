# 2026-07-03 Autofill stage animation fix

## Context
Seed growth craft uses asset progress stages (seed -> sapling) and the tile transform animation added in `cea7ece`. Manual DnD input storage animated acceptably, but auto-fill could emit multiple `craft_input.stored` events for the same target in one action. The visual planner created multiple craft stage transform motions for the same target tile, which stacked transient old tiles and enter requests over each other.

Craft completion also felt too fast because transform motions were still sub-second.

## Changes
- Coalesced craft stage update target visuals per `targetItemInstanceId` in `createGameEngineVisualPlan`.
- Kept auto-fill source fly-in visuals intact, but only one target flip/crossfade is created per craft target per action.
- Increased merge, craft replacement, and craft stage update visual durations to `1000ms`.
- Added visual plan regression coverage for multi-event craft auto-fill coalescing and 1s flip duration expectations.

## Verification
- `npm run format:check`
- `npm run audit:current`
- `npm run game:validate -- game/arkini`
- `npm run dc`
- `npm run typecheck`
- `npm run test`
- `npm run build`
- `npm run audit:optional`
