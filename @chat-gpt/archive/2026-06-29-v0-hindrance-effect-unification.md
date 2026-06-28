# 2026-06-29 — Hindrance/effect unification

Removed the standalone producer/product `hinderedBy` subsystem.

Decision:
- Negative production pressure belongs to the effect system.
- Pollution is now a passive effect source item.
- Do not reintroduce producer/product-owned hindrance side tables.

Implementation:
- Added local-only effect operation `duration.proximityPenalty`.
- The operation applies a duration multiplier per nearby source item.
- Multiplier uses the old proximity penalty semantics: `1 + (radius - distance + 1) * durationFactor`, clamped to at least `1`.
- Multiple source items stack multiplicatively through the normal effect pipeline.

Config migration:
- `item:pollution` now has passive effects:
  - `effect:pollution-slows-farms-and-beer`
  - `effect:pollution-slows-winery`
- Farm/beer product slowdown radius stays `2`.
- Winery slowdown radius stays `3`.
- Old `hinderedBy` entries were removed from products/producers and the compiled config.

Runtime cleanup:
- Removed `src/v0/game/hindrances/*`.
- Removed activation hindrance UI/view schemas.
- Producer line view now exposes `effectDurationMultiplier` instead of hindrance views.
- Item detail/product-line UI shows a compact `slowed Nx` meta label instead of a separate hindrance card.

Why:
- `hinderedBy` duplicated effect responsibility and made pollution a bespoke subsystem.
- Effects already support passive item sources, locality, duration mutation, target selection, and deterministic stacking.
