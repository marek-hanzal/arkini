# v0 product input up-to mode

Implemented `mode: "upTo"` for producer/stash product-line activation inputs.

Rules:

- Missing `mode` means existing exact behavior.
- `mode: "exact"` requires and consumes exactly `quantity` for a run.
- `mode: "upTo"` uses `quantity` as the per-run maximum.
- Up-to inputs can start with at least one stored/selected item.
- Auto-fill tries to fill up-to inputs to the per-run maximum before start.
- Stored up-to consumption removes `min(stored, quantity)` and leaves any extra pre-stocked capacity behind.
- Output remains fixed; it does not scale by consumed amount.

Config content change:

- Purifier I now has one product line only.
- `line:purifier-t1:pollution` consumes `1..4` `item:pollution` through `mode: "upTo"`.
- Removed the previous separate bulk purifier line and removed water/charcoal costs from purifier cleanup.
