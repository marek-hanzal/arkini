# 2026-06-30 - Effect output limit review

Deep review pass after effect/grant migration.

Findings fixed:

- Producer output max-count preflight/UI still treated `lootPlan.baseOutput` as always guaranteed and ignored deterministic `appendOutputs`.
  - New helper `readEffectiveOutputTargetLimits` derives limit pressure from the effective loot plan.
  - Base output only contributes to preflight limits when `baseDropChance >= 1`.
  - Appended outputs only contribute when `appendOutput.chance >= 1`.
  - Chance and weighted outputs remain runtime-delivery concerns, not hard start blockers.
- Stash drop preview still rendered only effective `baseOutput`.
  - Added `readRuntimeLootDropViewsFromEffectiveProductLine` so stash UI reflects base drop chance, appended outputs, and effect-added chance items.
  - Removed the stale base-config-only stash drop helper.

Regression tests added:

- Producer start is not blocked by maxCount when an effect makes base output drop chance zero.
- Producer start is blocked by maxCount when an effect appends a guaranteed output already at cap.
- Stash drop preview includes full effect-mutated loot plan.
