# Unified board remove/drop motion

- Renamed TileEngine drop animation `consume` to the clearer `remove` so source-removing drops no longer pretend they are a separate special path.
- Added shared tile remove motion constants/keyframes in `src/tile-engine/TileRemoveMotion.ts`.
- DnD remove drops now use the same remove keyframes as engine-driven `item.removed` transient exits.
- Board item removal through normal inventory, cheat inventory, producer/craft/stash inputs, and consume-mode tile removal now routes through the same TileEngine `remove` drop animation contract.
- Renamed the generic engine visual helper from the producer-specific `appendProducerDepletedRetainedTile` to `appendRemovedBoardItemVisuals`; producer depletion stays a special delayed retained-tile case inside the generic removed-board-item path.
- Validation: targeted interaction/drop/visual tests passed; full `npm run test` passed. Full `npm run check` still times out inside this container during the final all-in-one Vitest step after earlier stages pass, same wrapper problem as before.
