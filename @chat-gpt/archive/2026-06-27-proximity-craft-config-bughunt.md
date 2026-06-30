# Proximity/craft config bughunt

Status: DONE
Date: 2026-06-27

## Findings

This pass intentionally avoided speculative rewrites and fixed only reachable logic bugs.

### Running proximity requirement source leaving range sped production up

Producer proximity requirements were validated at start, but realtime duration recalculation ignored proximity requirements once their nearest source moved out of the configured range. Because missing/out-of-range proximity returned no multiplier, a running job could become faster after the player broke the required setup.

The duration multiplier now still uses the nearest matching source distance even when it is outside the configured requirement range. If no matching source remains on the board, it uses `requirement.distance + 1` as a deterministic missing-source penalty. Start readiness still rejects missing proximity as before; this only hardens running job resync.

Coverage: producer expectation test moving a required proximity source from distance 2 to distance 3 extends the running job from 2000ms to 3000ms instead of shortening it.

### Schema accepted craft results that cannot exist on board

Craft completion replaces the board target in-place. A craft recipe whose result item is inventory-only can never complete successfully as authored; runtime would consume/start work and only fail at completion with storage forbidden.

Config validation now rejects craft result items with `storage: "inventory"`.

### Schema accepted non-consumed craft inputs despite unsupported preservation

Craft start clears stored craft input state and craft completion replaces the board target. The runtime currently has no explicit return/preserve path for `consume: false` craft inputs, so accepting them would silently delete a supposedly non-consumed input.

Config validation now rejects `consume: false` craft recipe inputs until craft input preservation is intentionally designed.
