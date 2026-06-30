# v0 effect engine product-line gates

Completed work block: normalize ambient production rules into the effect resolver instead of producer-level requirement/proximity mechanics.

## Decisions

- Producer and stash definitions no longer accept top-level `requirementIds`. Producer-like shells only own queue/charges/product line ordering.
- Product lines remain the concrete production capability target. Any explicit stored/passive/proximity gate still lives on the product line, not the building shell.
- Requirement proximity is now a gate only. Requirement-owned `durationFactor` and the old proximity duration multiplier helper were removed. Production duration changes belong to duration effects.
- Arkini content migrated existing proximity production gates to local passive effects emitted by source items/buildings. Affected product lines are hidden by default and revealed by nearby effect sources.
- Tree -> Lumberjack now demonstrates stacked local effects: nearby trees reveal the lumberjack line and apply capped speed stacking through an effect category.
- Pollution-style duration pressure stays in the effect engine via `duration.proximityPenalty`.

## Coverage added/updated

- Effect resolver test for capped stacked operations by category/source count.
- Producer tests now cover product-line gates and effect-based duration/proximity behavior.
- Runtime board view tests verify proximity requirements no longer mutate duration and active effects still do.
- Config/audit tests updated for producer/stash shells without top-level requirements and for rejected requirement-owned proximity duration factors.

## Validation commands used

- `npm run game:compile -- game/arkini`
- `npm run game:validate -- game/arkini`
- `npm run typecheck`
- Targeted `vitest` suites for config, audit, producer, board runtime bridge, and effect resolver.
