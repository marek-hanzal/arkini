# Visible shared remove motion

Made the shared board item remove animation visibly communicate deletion.

## Decisions

- `TileRemoveMotion` duration is now 1000ms instead of the old quick 260ms blink.
- Shared remove keyframes now perform a bounce/pop, brief highlighted lift, second rebound, then shrink/fade out.
- Drop-remove and engine-driven `item.removed` exits still share the same keyframes and duration.
- Producer/stash depletion removals no longer use the old 1ms `merge-out` escape hatch. They now keep the delayed retained-tile behavior but exit through the same shared `remove` motion.
- Failed remove-drop cleanup resets `filter` in addition to opacity/transform because the shared remove animation now touches filter too.

## Validation

- `npm run test -- src/play/game-engine-visual/createGameEngineVisualPlan.test.ts src/tile-engine` passed.
- `npm run format:check`, `npm run audit:current`, `npm run game:schema:check`, `npm run game:validate -- game/arkini`, `npm run dc`, `npm run typecheck`, full `npm run test`, and `npm run build` passed.
