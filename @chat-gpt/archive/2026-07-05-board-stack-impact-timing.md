# Board stack impact timing

Completed follow-up pass for board stack feedback timing:

- Stack-to-stack and producer-to-stack visuals no longer reuse the generic 1000ms merge duration for the flying source item.
- Board stack fly motion now uses the normal tile move duration so the item reaches the target quickly.
- Stack bounce feedback uses a shorter stack-specific duration and starts slightly before fly completion, so the first visible bounce peak lands with the fly impact instead of feeling like a delayed second animation.
- Added regression coverage around producer output-to-stack, board stack action visuals, and the feedback delay being shorter than the fly duration.

Validation:

- `npm run test -- src/play/game-engine-visual/createBoardStackVisualPlan.test.ts src/play/game-engine-visual/applyGameEngineVisualPlan.test.ts --reporter=dot`
- `npm run typecheck`
- `npm run format:check`
- `npm run audit:current`
- `npm run game:schema:check`
- `npm run dc`
- `npm run game:validate -- game/arkini` (valid with known limited-deposit warnings)
- `npm run build` (passed with existing Vite large chunk warning)

Note: full `npm run test -- --reporter=dot` was attempted but hit the tool timeout before completion, so targeted visual tests remain the relied-on regression coverage for this small timing fix.
