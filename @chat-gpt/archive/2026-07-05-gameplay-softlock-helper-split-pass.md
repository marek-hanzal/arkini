# 2026-07-05 Gameplay softlock helper split pass

## Goal

Continue the GameConfigValidation cleanup by splitting the extracted gameplay soft-lock validator into LLM-friendly domain files without changing validation behavior.

## Changes

- Reduced `src/config/validation/validateGameplaySoftLockRisks.ts` from 1118 lines to a small orchestration module.
- Added dedicated soft-lock modules:
  - `GameplaySoftLockTypes.ts`
  - `GameplaySoftLockRequirements.ts`
  - `createGameplaySoftLockSources.ts`
  - `readGameplaySoftLockReachability.ts`
  - `readGameplaySoftLockEffectUsages.ts`
  - `validateGameplaySoftLockRequirementRisks.ts`
  - `validateProducerGameplayReachability.ts`
- Kept validation rules unchanged: starting sources, merge/removal/craft/line/passive/active sources, selector requirements, nearby board-source checks, grant source checks, grant require/block contradictions, and producer reachability still run from the same public entrypoint.
- Avoided barrel files and circular dependencies.

## Validation notes

Initial checks passed during the pass:

- `npm run format:check`
- `npm run audit:current`
- `npm run audit:dupes`
- `npm run game:schema:check`
- `npm run game:validate -- game/arkini`
- `npm run dc`
- `npm run typecheck`

`game:validate` still reports only the expected limited-deposit softlock warnings for finite deposits.
