# Disabled drop view truth

Deep review follow-up after drop-owned effects/live truth passes.

## Finding

Visible-but-disabled guaranteed/chance drops were still presented by UI view-models using their raw configured odds:

- guaranteed drops rendered as `100%` / `guaranteed`
- chance drops rendered as their configured probability

Runtime correctly excludes disabled drops from `lootPlan.baseOutput`, so this was a UI middle-truth bug: the drop is visible for explanation, but its current roll probability is zero.

## Fix

- `readRuntimeLootDropViewsFromEffectiveProductLine` now formats disabled guaranteed/chance drops as `0%`.
- `readRuntimeProductLineOutputViews` now exposes `probability: 0` for disabled guaranteed/chance outputs.
- Detail producer output meta therefore renders disabled guaranteed drops as `0% chance`, not `guaranteed`.
- Existing weighted behavior remains: disabled weighted entries show `0%/roll`.

## Tests

Added coverage for loot drop views, product line output views, and producer detail rendering.
