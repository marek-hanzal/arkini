# Seed growth craft

Implemented forest seed growth as a board craft flow instead of direct seed/sapling merge steps.

## Gameplay

- `Water + Micro-Forest` still consumes only water and rolls a chance output for `item:seed`.
- `item:seed` is now the growth/craft target.
- `item:seed` accepts 6x `item:water` as consumed craft inputs.
- While inputs are filled, seed uses `asset:item:seed` and `asset:item:sapling` as progress assets.
- After inputs are full, the seed craft runs for 30s and completes into `item:tree`. Running craft keeps `inputProgress = 1` so staged art remains on the mature/sapling asset during the timer.
- Removed standalone `item:sapling` gameplay item and removed `Water + Seed -> Sapling` / `Water + Sapling -> Tree` merge rules.

## UX note

We intentionally did not add extra persisted stage memory beyond existing craft input state. If the player withdraws inputs before the craft starts, the visual stage follows current stored inputs. This is accepted as current design rather than patched with special-case UI state.

## Guard

Added a default config test asserting that seed growth is craft-owned, `item:sapling` is not shipped as a standalone item, and water no longer has direct seed merge growth.
