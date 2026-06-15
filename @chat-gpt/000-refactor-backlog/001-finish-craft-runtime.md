# Finish craft/progress runtime

Status: TODO

## Goal

Turn craft/construction into a real runtime mechanic, not just input storage and view progress. It should follow the same architectural rules as activation:

- item instances are canonical storage
- input items are nested `itemInstance` rows
- runtime state stores only progress/timer metadata
- active progress only advances on board
- inventory preserves state but pauses progress
- commands return visual events
- commits are all-or-nothing

## Current state

Completed at baseline:

- `craft-input` nested item instances exist.
- Old `stateJson.craft.delivered` is migrated into `craft-input` rows.
- Board read model calculates craft input progress from nested item instances.
- Stateful craft items preserve nested storage when moved between board and inventory.

Missing:

- clean craft commands
- explicit craft runtime result types
- timer completion/claim flow
- command visual events for craft start/progress/claim
- user-facing feedback for ready/blocked craft states

## Proposed files

- `src/craft/type/CraftRuntimeStateSchema.ts`
- `src/craft/type/CraftResultSchema.ts`
- `src/craft/type/StartCraftInputSchema.ts`
- `src/craft/type/ClaimCraftInputSchema.ts`
- `src/craft/fx/startCraftFx.ts`
- `src/craft/fx/claimCraftFx.ts`
- `src/craft/fx/cancelCraftFx.ts` only if cancellation is confirmed useful
- `src/craft/fx/readCraftStateFx.ts`
- `src/craft/logic/resolveCraftProgress.ts`
- `src/command/CraftStartCommandSchema.ts`
- `src/command/CraftClaimCommandSchema.ts`

## Acceptance

- Craft/construction can receive required inputs through the existing drop/feed path.
- Craft starts only when inputs are complete and the item is on the board.
- Craft progress uses real-world wall-clock time while active on board.
- Moving the item to inventory pauses progress without deleting inputs.
- Moving back to board resumes according to the canonical time rules.
- Claiming craft result is all-or-nothing: either inputs/state are consumed and output is placed, or nothing changes.
- Commands emit visual events for input feed, craft start, craft ready, craft claim/spawn, and failed/blocked action where useful.
- Typecheck and build pass.

## Watchouts

- Do not store delivered inputs in `stateJson` again. That sewer is closed.
- Do not let inventory progress timers advance.
- Do not let stackable inventory behavior merge stateful craft instances.
