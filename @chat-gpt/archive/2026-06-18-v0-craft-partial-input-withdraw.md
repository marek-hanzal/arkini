# V0 craft partial inputs + single-unit withdraw

Date: 2026-06-18
Commit target: side quest after `8125220 Open full stash output batches`

## Outcome

Craft no longer behaves like an all-or-nothing input form. Craft targets now persist pre-start input progress in `save.craftInputs[targetItemInstanceId].items`.

Runtime contract:

- dropping a valid craft input onto a craft target dispatches `craft.input.store`
- each board input stores exactly one board item; inventory drops already pass `quantity: 1`
- stored input quantity is capped by the recipe input quantity
- craft start reads stored craft inputs; it no longer consumes direct `inputRefs`
- `craft.start` is only ready when all recipe inputs are fully stored and recipe requirements pass
- starting craft deletes the editable `craftInputs` bucket and creates the craft job
- `craft.input.withdraw` is allowed only before craft start
- withdraw removes one stored unit per UI click and places exactly one item back through `placeGameSaveItemsFx`
- withdraw seed is the craft target board position, matching producer/product withdraw placement rules
- no-space withdraw fails with `board:full` / `inventory:full` via `GamePlacementFailed` and leaves stored input state untouched
- running craft targets reject input store/withdraw through `craft_in_progress`

The completed craft replacement/crossfade path remains the same from earlier T2 follow-ups: completion replaces the target tile in place and TileEngine cross-fades old/new item visuals.

## Model changes

New actions:

- `craft.input.store`
- `craft.input.withdraw`

New save bucket:

- `craftInputs: Record<targetItemInstanceId, { items: Record<itemId, quantity> }>`

New domain events:

- `craft_input.stored`
- `craft_input.withdrawn`

New item event reasons:

- consumed: `craft-input-store`
- created: `craft-input-withdraw`

`GameSaveConfigSchema` validates craft input state centrally:

- target must still be a board craft item
- stored item must be a recipe input
- stored quantity must not exceed recipe input quantity
- editable craft input state must not coexist with a running craft job for the same target

## UI/runtime bridge

`readRuntimeBoardViewFromGameSave` now reports craft input progress from `save.craftInputs`, including:

- `delivered`
- `inputProgress`
- `acceptedInputItemIds`
- `canAcceptInputs`

The item sheet craft card shows `delivered/required` per input row and exposes a `Withdraw` button while the craft is still collecting inputs. The button withdraws one stored unit, mirroring product input withdraw's interaction style but with single-unit 1:1 semantics for craft input rows.

Drop routing now recognizes craft input storage separately from craft start. Regular merge remains higher priority than craft input storage, matching the existing DnD contract.

Craft recipe stored requirements are now exposed through the same stored requirement helpers/views as producer/stash requirements, so stored craft requirements can use the existing DnD requirement path instead of a bespoke craft-only UI hack.

## Tests added/updated

Coverage now includes:

- gradual craft input store for `2x water`
- start blocked until all craft inputs are stored
- start consumes/locks stored input state
- withdraw one stored craft input through seeded producer-style board placement
- withdraw placement failure preserves stored input state
- withdraw after craft start rejects
- save schema rejects craft input over capacity
- save schema rejects editable craft input state on running craft target
- board view shows partial and complete input progress without auto-starting craft
- visual bridge maps craft input withdraw output as craft-caused sequential spawn events

## Follow-up notes

This side quest intentionally does not introduce a special craft-only placement planner or separate UI storage form. Placement stays centralized in `placeGameSaveItemsFx`; UI only dispatches actions.

Potential future polish: craft requirements could get a richer dedicated display inside `ItemCraftCard`, but the runtime/action path already supports stored craft requirements through the generic stored requirement DnD flow.
