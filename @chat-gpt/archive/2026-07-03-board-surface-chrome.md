# Board surface chrome

## Summary
- Added subtle purple/pink board chrome around the main board without changing board sizing semantics.
- `TileEngine` now supports `rootClassName` so board-specific frame/padding/shadow styling does not leak into inventory or other tile-engine uses.
- Board grid gets rounded clipped corners, a darker grid background, inner border/shadow, and a stronger purple-ish cell fill for better contrast.

## Files touched
- `src/tile-engine/TileEngine.tsx`
- `src/tile-engine/TileEngine.types.ts`
- `src/tile-engine/TileEngine.test.tsx`
- `src/board/BoardSurface.tsx`
- `src/board/BoardCell.tsx`
- `src/app/styles.css`

## Verification
- `npm run format:check`
- `npm run audit:current`
- `npm run game:schema:check`
- `npm run game:validate -- game/arkini`
- `npm run dc`
- `npm run typecheck`
- `npm run test`
- `npm run build`
