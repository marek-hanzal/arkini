# 2026-06-28 - Gameplay debug 1s durations

## Change

Set every authored gameplay `durationMs` in the active `game/arkini` config to `1000` for fast gameplay-flow debugging.

Touched source config:

- `game/arkini/craft-recipes.json`
- `game/arkini/products.json`

Regenerated compiled config:

- `game/arkini.game.json`

## Intent

This is a temporary gameplay-debug tuning pass, not a runtime mechanic change. It speeds up producer product lines and craft/construction/growth timers so the game can be played through quickly during balancing and bug hunting.

## Notes

- `durationFactor` values were left untouched. They are multipliers, not authored time values.
- Engine, schemas, UI, and tests did not need behavioral changes.
