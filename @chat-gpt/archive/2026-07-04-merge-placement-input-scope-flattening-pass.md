# Merge, placement, and input scope flattening pass

## Commit scope

Follow-up deep quality pass after `fcd08de3`.

Flattened more local `Context.Tag` services that only carried stable call props through private Effect helpers:

- `src/merge/checkItemMergeReadinessFx.ts`
- `src/merge/mergeItemFx.ts`
- `src/placement/placeSingleGameSaveItemRequestFx.ts`
- `src/producer/checkProducerInputStoreReadinessFx.ts`
- `src/producer/storeProducerInputFx.ts`
- `src/producer/setLineDefaultFx.ts`
- `src/craft/checkCraftInputStoreReadinessFx.ts`
- `src/craft/storeCraftInputFx.ts`
- `src/craft/startCraftFx.ts`

The runtime behavior should stay unchanged; the data flow is now explicit props/scope objects instead of local ambient scope services.

## Rationale

These local services were not real dependencies. They hid `{ config, save, action, nowMs }` or already-resolved readiness state behind `Context.Tag`, which made route following harder without improving composability.

Keep `Context.Tag` for real ambient runtime services such as `GameConfigFx`, `GameSaveDraftScopeFx`, and `RandomServiceFx`. Do not use it as a private prop tunnel inside one file.

## Validation notes

- `npm run typecheck` passed during the pass.
- Full validation should still be run after the remaining edits in this working branch.
