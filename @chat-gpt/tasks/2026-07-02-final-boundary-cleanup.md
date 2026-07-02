# Final boundary cleanup pass - 2026-07-02

Context: final broad senior cleanup after `src/v0` removal and the alias/reexport cleanup passes. Goal was not feature work, but tightening ownership and catching lingering local truth / misplaced runtime code before moving back to gameplay work.

## Changes made

- Moved the board/item detail live clock hook out of the producer domain:
  - removed `src/producer/hook/useProducerClock.ts`
  - added `src/board/useBoardItemClock.ts`
  - updated board tile and item sheet callers

  The hook is React/view timing glue over board view items. It is not producer runtime logic, so keeping it under `producer` made the producer domain look like it owned React concerns.

- Moved drop intent resolution out of the merge domain:
  - removed `src/merge/resolveDropIntent.ts`
  - added `src/play/interaction/resolveDropIntent.ts`

  The resolver translates a generic item-to-board interaction plan into board drop feedback intent. It covers merge, craft inputs, producer inputs, stash inputs, remove rules and swap fallback, so `merge` was a lie.

- Moved the explicit merge rule resolver into the merge domain:
  - removed `src/engine/logic/resolveExecutableItemMergeRule.ts`
  - added `src/merge/resolveExecutableItemMergeRule.ts`

  The engine should orchestrate actions and ticks, not own domain-specific rule lookup helpers just because multiple callers need them.

- Tightened dependency-cruiser boundaries:
  - the old `domain-fx-no-react-imports` rule only covered stale `/fx` folders and no longer protected the new flat root domains
  - added broad core-domain React import protection
  - added `merge`, `producer` and `random` to runtime/UI import protection

## Verification checklist

Run before handoff:

- `npm run format`
- `npm run format:check`
- `npm run game:validate -- game/arkini`
- `npm run dc`
- `npm run typecheck`
- `npm run test`
- `npm run build`
- `npm run audit:optional`

Known existing warnings remain acceptable:

- Biome skips `game/arkini.assets.json` because it is larger than the configured file size limit.
- `game:validate` reports existing unused packaged PNG resources.
- Vite warns about a >500 kB JS chunk.
