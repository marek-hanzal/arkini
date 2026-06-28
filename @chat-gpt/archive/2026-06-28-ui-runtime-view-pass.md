# UI runtime view pass

Status: DONE

## Goal

Remove remaining UI-local gameplay truths around producer/stash/craft run states, progress, delivery blocks, stored-requirement feedback, and Store affordances.

## Completed

- Added shared UI run-state readers for producer-like product lines and craft cards/taps.
- Product-line cards now receive live runtime line views from the sheet and do not compute their own live progress clock.
- Producer default board tap, product-line card actions, and stocked/dim readiness use the same product-line run-state rules.
- Craft detail card and board tap use the same craft run-state rules, including auto-fill availability, requirements, pause, ready, and blocked delivery.
- Producer-like product lines expose queue-wide blocked reason so a blocked/paused queue disables all affected UI actions instead of only the active line.
- DnD stored-requirement feedback now checks runtime requirement details and does not treat passive/proximity requirements as droppable stored inputs.
- Store button state now uses a shared board-item store-state reader and disables storing busy producer-like/craft items that backend would reject.

## Watchouts

- UI components should consume runtime/view data and small run-state readers; do not reintroduce card-local progress/readiness/action guesses.
- `missingRequirementItemIds` is a hint list, not proof that an item can be stored into a requirement. Check requirement view details for `type: "stored"` before showing stored-requirement DnD feedback.
