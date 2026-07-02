# Embedded item capabilities pass

Status: DONE

Commit: pending

## Goal

Move authoring config away from single-owner top-level ID registries and toward item-owned capabilities. The root item definition should carry the gameplay pieces it owns instead of forcing runtime/schema/validator code to chase `productIds`, `mergeIds`, `craftRecipes`, `producers`, and `stashes` maps.

## Completed

- Removed top-level authoring files from `game/arkini`: `products.json`, `producers.json`, `stashes.json`, `craft-recipes.json`, and `merge.json`.
- Embedded capabilities into `items.json`:
  - `item.producer.lines`
  - `item.stash.line`
  - `item.craft`
  - `item.merges`
  - existing `item.removeBy`
- Compiled `game/arkini.game.json` now has no top-level `products`, `producers`, `stashes`, `craftRecipes`, `merge`, `productIds`, or `mergeIds`.
- Split config schemas into standalone schema files under `src/v0/game/config/schema/*` instead of inline blob schemas.
- Reworked validator traversal to validate embedded capabilities directly.
- Updated compiler/package normalization to derive defaults inside embedded item capabilities.
- Updated runtime/craft/producer/stash/merge/UI bridge code to read capabilities from items.
- Test helper fixtures now use explicit embedded-capability overrides; no compatibility layer is part of production config or runtime.

## Important constraints after this pass

- Stable `itemId` remains the cross-item identity. Outputs/inputs/selectors still reference item IDs.
- Producer line `id` remains because saves/jobs/defaults need a stable local identity inside the owning producer/stash capability.
- Do not reintroduce top-level single-owner registries for producer lines, craft recipes, merge rules, producers, or stashes.
- Runtime should prefer item-owned capability reads and avoid global capability indexes unless there is an explicit, documented reason.

## Validation

- `npm run format:check`
- `npm run game:compile -- game/arkini`
- `npm run game:validate -- game/arkini`
- `npm run dc`
- `npm run typecheck -- --pretty false`
- `npm run test -- --reporter=dot`
- `npm run build`
