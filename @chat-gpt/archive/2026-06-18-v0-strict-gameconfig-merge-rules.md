# v0 strict GameConfig merge rules

Status: DONE 2026-06-18
Commit: pending in current task

## Decision

Merge/interactions are explicit source-owned `GameConfig` rules. The engine must not invent a reverse executable merge from a target-owned rule.

If `sourceItem.mergeIds` contains a merge whose `withItemId` is the target item, then `source -> target` may execute. If that source-owned rule does not exist, the merge action does not exist.

The `water -> twig` sprout interaction is now authored as `merge:water-twig-sprout` on `item:water`. `item:twig` no longer owns a water sprout rule, so `twig -> water` is not a merge unless the config later adds its own explicit twig-owned rule.

Blueprint/building imprint follows the same rule model. Building items own directed imprint rules for building -> blueprint. Blueprint -> building does not become a merge just because the target building has a directed rule.

## Guardrail

`hasReverseDirectedItemMergeRule` may still reject reverse-directed imprint drops before swap. That is not an executable merge fallback; it prevents a directed config interaction from becoming a normal swap when dragged backwards.

## Implementation

- `resolveExecutableItemMergeRule` now only checks `sourceItem.mergeIds`.
- Removed the previous regular combo reverse lookup fallback.
- Updated source and compiled game config so water owns the sprout merge rule.
- Updated tests and comments that incorrectly claimed regular combo merges work from either direction.

## Regression target

- `water -> twig` resolves to `sprout` because `item:water` owns `merge:water-twig-sprout`.
- `twig -> water` falls through to non-merge behavior because `item:twig` does not own a water rule.
- `building -> blueprint` directed imprint remains executable.
- `blueprint -> building` remains non-executable and is rejected before swap.
