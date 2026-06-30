# Product-line output owned count UI

Player-facing product-line detail headers now show the product output item image and the current owned quantity for that output across board plus inventory.

Runtime view ownership:

- `readRuntimeProducerProductLineViewsFromGameSave` derives `line.outputs` from the product output config.
- Each output has `itemId` and `ownedQuantity`.
- `ownedQuantity` intentionally counts board plus inventory via the central save quantity reader, not a local UI scan.
- Duplicate output item ids are collapsed before rendering so weighted/multi-output definitions do not spam repeated icons.

UI rule:

- `ItemProducerProductLinesCard` renders output icons in the product-line header.
- Single-output lines show `Owned N`.
- Multi-output lines show per-output names and counts.

This keeps product-line planning visible in item detail without reintroducing forward-use encyclopedias or local UI truth.
