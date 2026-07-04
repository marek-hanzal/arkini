# 2026-07-05 effective drop helper split pass

## Context

Continuation of the deep cleanup after `readEffectiveLine` was reduced to final assembly. `readEffectiveDrop.ts` still carried all concrete drop-effect behavior: requirement gates, grant toggles, chance effects, display filtering, outcome creation, and grant selector matching.

## Change

Split `readEffectiveDrop.ts` into focused helpers:

- `EffectiveDropEvaluation.ts` owns the evaluation/application props types.
- `createEffectiveDropEffectOutcome.ts` owns outcome creation and display filtering.
- `readDropEffectGrantActive.ts` owns grant selector activation checks.
- `applyEffectiveDropRequirementEffect.ts` owns `grant.require`, `nearby.require`, and `grant.blockStart` behavior.
- `applyEffectiveDropToggleEffect.ts` owns grant-based show/hide/enable/disable behavior.
- `applyEffectiveDropChanceEffect.ts` owns nearby and grant extra-output chance behavior.
- `applyEffectiveDropEffect.ts` owns the exhaustive drop-effect dispatch.
- `readEffectiveDrop.ts` now only iterates effects, labels them, applies them, and folds the resulting evaluation.

## Rationale

The old `readEffectiveDrop.ts` was not logically wrong, but it forced unrelated effect behaviors into one large file. New output/drop effect changes should land in the helper that owns that effect family instead of growing another effect blob.

## Validation

Initial validation passed:

- `npm run format:check`
- `npm run typecheck`
- `npm run audit:current`
- `npm run game:schema:check`
- `npm run game:validate -- game/arkini` with the known finite deposit softlock warnings
- `npm run dc`
