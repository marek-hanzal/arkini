# Completed baseline before this backlog

Status: DONE

Baseline commit: `6b86b70 Normalize craft inputs and activation requirements`

## Completed

- Removed `dnd-kit` and moved drag/pointer ownership into TileEngine/Motion-based runtime.
- Preserved PNG assets in `src/assets`.
- Added typed game config ID schemas using the `Schema.Type` namespace pattern.
- Split the huge `GameConfig` into focused manifest config files.
- Added typed command boundary under `src/command`.
- Removed old `src/action` command layer.
- Added domain view models for board, inventory, item catalog, upgrades, drag view data, and save metadata.
- Moved read hooks to `useSuspenseQuery` and app-level Suspense fallback.
- Removed `usePlayShellController` monolith and replaced it with focused PlaySession runtime contexts/hooks.
- Normalized board/inventory storage into `itemInstance` table.
- Added `activation-input` item instance storage for producer/stash inputs.
- Unified producer/stash activation through `src/activation` pipeline.
- Introduced command visual events.
- Added game-level animation staging from command visual events while keeping TileEngine standalone.
- Added persistent activation requirements that are checked but not consumed.
- Normalized craft inputs into `craft-input` item instance storage.

## Important current constraints

- TileEngine must remain standalone. Game-specific event mapping belongs in `src/animation` or feature hooks, not inside `src/tile-engine`.
- Producer/stash `inputs` are consumable.
- Producer/stash `requirements` are persistent and non-consumable.
- Craft/construction progress should use item instance input storage and state JSON only for timer/progress metadata.
- Inventory is passive. Active timers do not run inside inventory.
