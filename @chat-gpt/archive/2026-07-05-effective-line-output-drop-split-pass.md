# Effective line output/drop split pass

Commit: see git log entry `Split effective line output drop helpers`

## What changed

- Split `readEffectiveLine.ts` down to final effective-line assembly only.
- Added `readEffectiveDrop.ts` for concrete output drop-effect evaluation: grant/nearby requirements, start blockers, hide/show, enable/disable, nearby bonus chance, and grant bonus chance.
- Added `readEffectiveOutputEntries.ts` for visible/rollable output assembly, rollable chance-item filtering, and output-owned duration effects.
- Added `RuntimeLineEffectTypes.ts` so runtime line/drop effect aliases and `RuntimeItemSelector` stop being duplicated across nearby matching, labels, drop evaluation, output evaluation, and requirement evaluation.

## Rationale

`readEffectiveLine.ts` had already lost some helper concerns in the previous pass, but it still mixed three separate mental layers:

1. final line assembly,
2. output entry rollability/visibility/chance/duration assembly,
3. concrete drop-effect semantics.

The new shape keeps those layers separated without creating a swarm of tiny effect files. This should make future output-owned effect work land near the code it actually changes instead of inflating the old all-in-one blob again.

## Validation

- `npm run typecheck`
- `npm run format:check`
- `npm run audit:current`
- `npm run game:schema:check`
- `npm run game:validate -- game/arkini`
- `npm run dc`
- `npm run audit:optional`
- targeted effects/producer tests
