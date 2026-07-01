# Drop-owned effects refactor

- Product-line loot chance modifiers moved from product `effects` to concrete `output[*].effects` / weighted `entries[*].effects`.
- Drop effects are evaluated top-to-bottom on a single output entry and return `visible`, `enabled`, `dropEffects`, and same-drop bonus `chanceItems`.
- Runtime/UI now use `visibleOutput` for detail/drop surfaces and `baseOutput` only for rollable enabled output. Disabled drops remain visible with explanation rows; hidden drops disappear.
- UI output/drop view schemas expose per-drop `enabled` and `effects` summaries so components do not re-evaluate effect logic locally.
