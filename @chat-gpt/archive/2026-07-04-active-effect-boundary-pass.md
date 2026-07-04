# Active effect boundary pass

Commit: see git log (`Centralize active effect writes`)

## What changed

- Added `src/effects/writeActiveEffectToSaveFx.ts` and `src/effects/removeActiveEffectFromSaveFx.ts` as the only production write/remove boundaries for `save.activeEffects`.
- Routed producer line start, realtime producer sync, blocked-delivery queue reschedule, active-effect expiry, and board-item runtime cascade cleanup through those boundaries.
- Extended `audit:current` to reject raw production `save.activeEffects[...] = ...` and `delete save.activeEffects[...]` outside the named boundaries.

## Why

Active effects are mutated from several timing-heavy routes: line start, queue retiming, realtime sync, expiry, and source-item removal. Keeping each route as a private map write makes future lifecycle changes easy to miss. The boundary keeps the lifecycle grepable without pretending this is a new service layer.

## Validation

- `npm run format:check`
- `npm run typecheck`
- `npm run audit:current`
- `npm run audit:optional`
- `npm run game:schema:check`
- `npm run game:validate -- game/arkini`
- `npm run dc`
- `npm run build`
- Relevant tests: active-effect expiry, producer actions, game tick, stash, board memory.
