# V0 inventory stateless stack policy

Date: 2026-06-18
Task: stabilization epic T6

## Outcome

Inventory now has an explicit two-shape save slot model:

- stateless stack: `{ itemId, quantity }`
- preserved instance: `{ kind: "instance", id, itemId }`

The policy is now concrete instead of implied by vibes and crossed fingers:

- regular generated/stateless items stack exactly as before
- preserved item instances occupy exactly one inventory slot
- stateless placement never stacks into an inventory instance slot, even when `itemId` matches
- inventory instance slots count as quantity `1` for passive requirements, upgrade cost availability and input resolution
- consuming an inventory instance as an input deletes that slot and clears runtime state for that instance
- placing an inventory instance back on the board reuses the same `itemInstanceId`, preserving its runtime state buckets

## Stateful board stash behavior

`board.item.stash` now checks runtime state before moving a board item to inventory.

If the board item has a running producer/craft job, stash is rejected with `item_busy`. Running jobs still require a board target, so silently moving them to inventory would create cursed target references.

If the board item has preservable runtime state, it is moved to inventory as an instance slot and its runtime state is kept:

- `stashes[itemInstanceId]`
- `producerLines[itemInstanceId]`
- `producerInputs[itemInstanceId]`
- `craftInputs[itemInstanceId]`
- `storedRequirements[itemInstanceId]`

If the board item has no runtime state, it follows the old stateless path and can stack in inventory according to `maxStackSize`.

## Save validation

`GameSaveConfigSchema` now validates inventory instances:

- instance item must exist
- instance id must not collide with a board item id
- instance ids must be unique across inventory slots
- runtime state targets may reference either a board item or an inventory instance
- producer/craft jobs still require board targets

This keeps saved state honest without scattering inventory integrity checks across storage/UI/runtime plumbing.

## Runtime/view bridge

Inventory view rebuild now exposes inventory instances as `stateful: true`, quantity `1`, and uses the preserved `itemInstanceId` as the visual id. Stack slots keep the previous generated runtime inventory id.

Helpers were added under the engine model/fx layer:

- `GameSaveInventorySlot.ts`
- `readBoardItemRuntimeStateStatus.ts`
- `placeGameSaveInventoryInstanceFx.ts`

## Tests

Added coverage for:

- inventory instance save schema acceptance with preserved craft input state
- duplicate inventory instance ids rejected
- inventory instance id collision with board item rejected
- stateful stackable board item stashed into a separate instance slot instead of an existing same-item stack
- placing an inventory instance back to board preserves the same `itemInstanceId` and runtime state
- stashing an item with a running craft job rejects with `item_busy`
- stateless placement does not stack into inventory instance slots

## Follow-up

T7 changed direction after follow-up: remove save ID counters and generate runtime entity IDs through `genId`/cuid2 with domain prefixes. No monotonic counter validation is needed because the counters are gone.
