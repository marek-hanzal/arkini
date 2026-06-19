# v0 TileEngine slot long-press split

Status: done on 2026-06-19.

## What changed

`TileEngineSlot.tsx` was reduced to slot render/drop registration orchestration.

Extracted flat TileEngine helpers:

- `useTileSlotLongPress.ts` - empty-slot/slot long-press pointer timer lifecycle.
- `useTileSlotFeedbackDebug.ts` - slot feedback debug timeline effect.
- `sameTileEngineSlotProps.ts` - memo comparison for slot props.
- `sameOptionalTileEngineTile.ts` - optional tile equality used by slot prop comparison.

## Guardrails kept

- No nested folders were added inside `src/v0/tile-engine`.
- No Arkini domain import entered TileEngine.
- Public TileEngine API stayed unchanged.
- Long-press behavior is intended to stay behavior-preserving: primary-button pointer down starts the timer, pointer leave/up/cancel clears the active pointer timer, unmount cleanup clears it too.

## Validation

Ran:

- `npm run check`
- `npm run game:validate -- game/arkini.game.json game/arkini.assets.json`
- `npm run build`

All passed. Existing generated asset size warning and Vite chunk warning remain.
