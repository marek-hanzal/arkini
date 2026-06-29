# v0 effect benefit UI

- Added shared runtime effect operation summaries for player-facing copy.
- Active effect product-line views now expose `effectBenefits`, so shrine/buff cards show what the player buys before requirements and inputs.
- Reused the same summary helper for passive generated-effect detail cards; this also fixed missing `loot.quantity.add` copy that previously fell through as item blocking.
- Covered shrine haste/quantity benefit summaries plus detail-card benefit placement in tests.
