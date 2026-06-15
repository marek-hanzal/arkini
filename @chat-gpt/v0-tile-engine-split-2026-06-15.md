# v0 TileEngine split

Status: DONE

## Goal

Split `src/v0/tile-engine/TileEngine.tsx` from one large implementation blob into a small public entrypoint plus focused internal components/hooks. The public `TileEngine` stays the single game-agnostic API for board/inventory drag, drop and tile animation, but the implementation is now readable in slices instead of one blessed mud ball.

## Library check

No new dependency was added. The engine already uses `motion` for FLIP/snap/reject animations and plain React pointer events for lifecycle control. That is still the right fit here because the engine owns grid-specific hit testing, handoff and stable tile actors; delegating this to a generic DnD library would fight the architecture we are rebuilding.

## Result

`TileEngine.tsx` now only wires:

- slot/tile indexes
- drop registration/resolution
- drag handoff
- slot layer
- actor layer

The former inline logic was moved into domain-owned pieces:

- `TileEngineSlot.tsx` / `TileEngineSlots.tsx`
- `TileEngineActor.tsx` / `TileEngineActors.tsx`
- `TileEngineActor.types.ts`
- `TileEngineDrop.types.ts`
- `useTileActorDrag.ts`
- `useTileActorMotion.ts`
- `useTileActorTap.ts`
- `useTileActorTimers.ts`
- pointer-specific hooks: down/move/up/cancel
- drop resolution helpers
- tiny animation/geometry helpers

## Notes

Tile identity behavior is unchanged: actor keys stay `tile.id`, slots stay `slot.id`, and snap/handoff semantics stay in the engine. This commit is a structural split only, not a behavior rewrite.

## Validation

- `npm run format:check`
- `npm run typecheck`
- `npm run build`
- `git diff --check`
- active greps for `switch (`, `getQueryData`, `useQuery(` and custom context/provider stayed clean.
