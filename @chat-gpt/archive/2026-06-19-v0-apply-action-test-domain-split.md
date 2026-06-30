# v0 apply action test domain split

Completed: 2026-06-19.

## What changed

The former `src/v0/game/engine/fx/applyGameActionFx.test.ts` was split by domain family:

- `applyGameActionProducerFx.test.ts`
- `applyGameActionCraftFx.test.ts`
- `applyGameActionStashFx.test.ts`
- `applyGameActionStoredRequirementFx.test.ts`
- `applyGameActionMergeRemoveFx.test.ts`
- `applyGameActionBoardInventoryFx.test.ts`

Shared helper plumbing moved to `applyGameActionFx.testSupport.ts`.

## Why

The old single action test file mixed producer, craft, stash, stored requirement, merge/remove, board/inventory placement, and runtime stash behavior in one 2k+ line file.

Splitting tests first creates safer domain anchors before moving production engine files out of the `fx` megabucket.

## Guardrail

This was a test topology change only. Do not infer behavior changes from the split.
