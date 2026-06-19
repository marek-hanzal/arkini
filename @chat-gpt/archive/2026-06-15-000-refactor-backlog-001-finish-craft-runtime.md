# Finish craft/progress runtime

Status: DONE

## Goal

Turn craft/construction into a real runtime mechanic, not just input storage and view progress. It should follow the same architectural rules as activation:

- item instances are canonical storage
- input items are nested `itemInstance` rows
- runtime state stores only progress/timer metadata
- active progress only advances on board
- inventory preserves state but pauses progress
- commands return visual events
- commits are all-or-nothing

## Completed

- Added explicit craft runtime state schema in `src/craft/type/CraftRuntimeStateSchema.ts`.
- Added craft claim result/input schemas in `src/craft/type/CraftResultSchema.ts` and `src/craft/type/ClaimCraftInputSchema.ts`.
- Added `startCraftFx` for the moment a board craft receives its last required input.
- Added `claimCraftFx` for explicit all-or-nothing craft claiming.
- Added `craft.claim` command and routed it through `runCommandFx`.
- Added `craft.started` and `craft.claimed` command visual events.
- Removed the old board read-model side effect that silently converted ready craft targets during `readViewFx`.
- Board single-activation now claims a ready craft before falling back to producer/stash activation.
- Craft progress still pauses in inventory and resumes on board through existing board/inventory movement hooks.
- Craft input storage remains nested `itemInstance` rows. No delivered inputs are stored in `stateJson`.

## Notes

- Craft still receives inputs through the existing board drop/feed path (`board.merge`) because the interaction is physically the same tile-to-tile gesture. The command emits `item.consumed` and `craft.started` when the last input starts the timer.
- There is no standalone `craft.start` user command yet. Starting is an internal domain transition when inputs become complete on the board. Add a public `craft.start` command only if we later want manual start UX.
- There is no separate timer-fired `craft.ready` command event because readiness is derived from wall-clock time in the board read model. The explicit user command is `craft.claim`.

## Acceptance

- [x] Craft/construction can receive required inputs through the existing drop/feed path.
- [x] Craft starts only when inputs are complete and the item is on the board.
- [x] Craft progress uses real-world wall-clock time while active on board.
- [x] Moving the item to inventory pauses progress without deleting inputs.
- [x] Moving back to board resumes according to the canonical time rules.
- [x] Claiming craft result is all-or-nothing: either inputs/state are consumed and the target becomes the result item, or nothing changes.
- [x] Commands emit visual events for input feed, craft start, and craft claim.
- [x] Typecheck and build pass.

## Watchouts

- Do not store delivered inputs in `stateJson` again. That sewer is closed.
- Do not let inventory progress timers advance.
- Do not let stackable inventory behavior merge stateful craft instances.
