# Capacity tap feedback

- `item.capacity.changed` is now a visual event instead of being ignored outright.
- Capacity-backed deposits now bounce whenever a line spends nearby capacity, including non-depleting spends where the source still has remaining capacity.
- Depleted capacity sources keep their retained transient tile alive until the tap feedback finishes, then run the existing remove motion. This avoids the feedback being swallowed by the removal transform.
- Coverage lives in `createCapacityTapVisualPlan.test.ts` so the already-large visual planner test file stays below the audit guardrail.

Validation:

- `npm run format:check`
- `npm run audit:current`
- `npm run game:schema:check`
- `npm run dc`
- `npm run game:validate -- game/arkini`
- `npm run typecheck`
- `npm run build`
- targeted Vitest for capacity tap visuals and capacity spend effects
