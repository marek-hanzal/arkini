# V0 effective upgrade/config validation

Datum: 2026-06-18
Commit target: T4 from `v0-stabilization-epic-2026-06-18.md`

## What changed

`GameConfigSchema` now validates effective upgrade prefixes instead of only the base authoring shape.

The validator simulates upgrade effects in runtime application order and also checks single-upgrade tier prefixes when multiple upgrades exist. The point is to catch configs where a later completed tier would make the resolved runtime config invalid even though the raw JSON shape still parses.

Validated effective values:

- `product.duration.add` must keep product `durationMs > 0`.
- `product.input.quantity.add` must keep the effective input quantity `> 0`.
- Product input quantity upgrades must stay `<= capacity`.
- Product input quantity upgrades are checked against the effective `inputRefId`, so a prior `product.inputRef.set` in the same prefix is respected.
- `producer.maxQueueSize.add` must keep effective queue size `> 0`.

Product definitions now require positive `durationMs`; zero-duration products are not valid producer jobs. Craft recipe duration is still allowed to be zero because existing craft content uses instant craft transforms.

## Runtime cleanup

`buildConfigLayerFx` no longer clamps bad upgrade effects with `Math.max`. Bad effective config should be rejected by schema validation instead of silently normalizing into weird runtime states.

Related layer schemas were tightened:

- `GameConfigLayerProductSchema.durationMs` is positive when present.
- `GameConfigLayerProductInputSchema.quantity` is positive.

`GameSaveConfigSchema` effective producer queue reading also stopped clamping. Save validation should validate against the real effective config, not a padded fairy-tale version of it.

## Tests

Added `GameConfigSchema` tests for:

- duration reduced to zero,
- input quantity reduced to zero,
- input quantity increased above capacity,
- queue size reduced below one,
- quantity upgrade after `inputRef.set` using the new effective ref.

Updated the runtime upgrade test that previously used `product.input.quantity.add: -1` to make a product free. That is no longer a valid authoring path. The test now increases input cost and verifies future product readiness expects the upgraded quantity.

## Follow-up

T5 is still needed: product input overlay scope should be explicitly represented so product-scoped upgrades cannot accidentally mutate a shared top-level input definition used by another product. T4 validates values; T5 fixes the shape/semantics of product-resolved inputs.
