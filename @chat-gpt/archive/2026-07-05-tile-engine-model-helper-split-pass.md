# 2026-07-05 — Board/inventory tile engine model helper split

## Commit

See git history for this archive entry.

## Goal

Continue the LLM-friendly refactor plan after runtime adapter and producer/world/UI/test splits. The next high-value UI/control bridge candidates were the board and inventory tile-engine model hooks.

## Changes

- Split `src/board/useBoardTileEngineModel.ts` into a thin hook plus helpers for:
  - board tile-engine types,
  - board item sheet resolution,
  - slot read model,
  - tile read model,
  - blocked cell keys,
  - board tile drag actor,
  - board cell drop target,
  - runtime drop feedback,
  - opening the live board item sheet,
  - board drag config assembly.
- Split `src/inventory/useInventoryTileEngineModel.ts` into a thin hook plus helpers for:
  - inventory tile-engine types,
  - slot read model,
  - tile read model,
  - placement-on-board action flow,
  - inventory tile drag actor,
  - inventory slot drop target,
  - runtime drop feedback,
  - inventory drag config assembly.

## Result

- `useBoardTileEngineModel.ts`: ~381 lines → 82 lines.
- `useInventoryTileEngineModel.ts`: ~361 lines → 67 lines.
- Behavior intentionally unchanged; this is a responsibility split for UI/control bridge readability.

## Validation

- `npm run format:check`
- `npm run audit:current`
- `npm run audit:dupes`
- `npm run game:schema:check`
- `npm run game:validate -- game/arkini`
- `npm run dc`
- `npm run typecheck`
- targeted board/inventory/tile/drop tests
- full suite by blocks including CLI tests
- `npm run build`
