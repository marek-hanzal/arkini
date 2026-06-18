# v0 merge executable parity

Status: DONE 2026-06-18
Commit: pending in current task

## Decision

Regular combo merge rules are executable item pairs. They must work from either drag direction:

- source item owns the merge id -> execute directly
- target item owns a regular merge id whose `withItemId` is the source -> execute as the same combo

Directed/imprint rules are the exception. `consumeSource: false` rules stay one-way and only execute when the dragged/source item owns the merge id. Reverse-directed drops are rejected instead of silently becoming swaps.

## Why

Reported bug: the game config contains `merge:twig-water-sprout`, but water/twig interaction fell through to swap from at least one direction. UI/detail hints were derived from config merge relations, while runtime merge resolution was source-owned only. That made regular combo rules feel broken and made the detail sheet look like it was lying to the player, because naturally software needed another way to disappoint everybody.

## Implementation

Central helper:

- `src/v0/game/engine/logic/resolveExecutableItemMergeRule.ts`

Consumers:

- `checkItemMergeReadinessFx`
- `resolveDropIntent`
- `useGameRuntimeDropActions`
- `readRuntimeItemCatalogViewFromGameConfig`

Item catalog merge relations now use the executable resolver instead of raw config scans. This keeps detail relations aligned with actual board/runtime behavior. Regular symmetric pairs are shown as source-executable merge results and not duplicated in reverse “used in merges”. Directed imprint relations remain one-way.

## Regression coverage

- `item:twig` + `item:water` resolves as `item:sprout` from both directions.
- Runtime `item.merge` handles reverse regular combo source/target order.
- DnD board drop action maps both water/twig directions to `parallel-merge`, not swap.
- Directed blueprint imprint stays one-way.
