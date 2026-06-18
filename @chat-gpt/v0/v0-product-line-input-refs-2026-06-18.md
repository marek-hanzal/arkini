# v0 product-line input refs

Status: completed 2026-06-18

Producer-level consumable inputs are removed from the live model. A producer shell can have requirements and product lines, but only product lines own consumable production inputs.

## Current model

- `GameConfig.inputs` is a top-level named input definition record.
- Product lines reference consumable inputs through `products.*.inputRefId`.
- `readProductInputs({ config, productId })` is the shared config helper. Do not read `product.inputs`; that field is gone.
- Coal mine I uses `input:coal-mine-1-rations`, which currently accepts sausage and beer.
- Upgrades can change a product line input definition through `product.inputRef.set`.
- Existing `product.input.quantity.add` applies to the effective input definition for the product line.

## Runtime behavior

- Producer shell `activation.inputs` is intentionally empty in board views.
- `ProducerProductLineView.inputs` exposes the line's stored consumable input status for UI display.
- Product start with no explicit `inputRefs` consumes stored producer line inputs from `save.producerInputs[producerItemInstanceId].productInputs[productId]`.
- Explicit product start input refs still work and are validated against the line input definition.
- `producer.input.store` stores a dragged/selected item into the first enabled product line, in `producer.productIds` order, that accepts the item and has remaining capacity. If `productId` is provided, it targets that line only.
- Disabled lines are skipped when resolving duplicate/shared input placement.
- Stored product-line inputs are validated centrally by `GameSaveConfigSchema`.

## UI / DnD

- Product line cards display their own input rows and readiness.
- Missing product-line inputs are filled through DnD/merge-like interaction onto the producer tile. No special store buttons.
- Drop feedback for product-line consumable input stays generic `secondary` through TileEngine.

## Important invariants

- Producer-level consumable inputs should not be reintroduced.
- Product-line input definitions are standalone named entities so upgrades can swap `inputRefId`.
- If several product lines share the same input, auto-placement goes top-to-bottom by enabled product line order.
