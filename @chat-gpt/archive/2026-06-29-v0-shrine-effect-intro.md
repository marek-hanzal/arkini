# Shrine active-effect intro

Status: DONE

## Completed

- Added `producer:shrine-t1` to the starting board as an early effect-source building.
- Added two active effect product lines:
  - `line:shrine-t1:minor-haste` activates `effect:shrine-minor-haste` for 5 minutes and multiplies selected basic line durations by `0.75`.
  - `line:shrine-t1:bountiful-offering` activates `effect:shrine-bountiful-offering` for 3 minutes and adds `+1` quantity to selected basic outputs.
- Added `loot.quantity.add` as a first-class effect operation for product-line loot quantity boosts.
- Added separate runtime defaults for effect lines and product lines. A producer can have both; click priority is runnable default effect first, then runnable default product.
- Active/scheduled effect lines are locked until their active effect expires. They cannot be bought/refreshed again while locked.
- Producer detail UI now renders effect/boost lines above normal product lines, with FX affordance, locked progress button, and effect window metadata.
- Board tiles with an active/scheduled effect line show a compact `FX` badge.

## Tests

- Covered default effect/product coexistence, effect-first click priority, fallback to product while effect is locked, duplicate active effect rejection, board tap priority, stocked-state priority, and `loot.quantity.add` mutation.
- `npm run format:check`, `npm run game:validate -- game/arkini`, `npm run dc`, `npm run typecheck`, and `npm run test` pass. Biome still warns that `game/arkini.assets.json` is larger than configured max size.

## Notes

- Active effects still use the producer job window model: the effect is the running product, starts at the queued job start, and expires at `readyAtMs`. This matches the current “same as running product” behavior and keeps the button locked until expiry.
- If we later want multiple effect lines on the same producer to run truly in parallel, that should be a separate runtime design change rather than silently breaking producer queue semantics.
