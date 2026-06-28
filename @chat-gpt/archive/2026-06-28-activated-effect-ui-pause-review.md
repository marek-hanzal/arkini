# 2026-06-28 Activated effect / producer UI pause review

Completed sweep around producer/stash/craft/effect timing after shared pausable-job work.

- Verified product-activated temporary effects pause through their linked producer job when producer/product requirements break, including product-level proximity requirements, then resume with the original remaining duration.
- Added schema guard: product `activatesEffectId` may not point at an inventory-only source effect, because activated effects are emitted by the board producer item instance while the producer job is running.
- Exposed blocked-delivery state on producer-like product line views so UI no longer renders blocked delivery as fake running progress.
- Moved producer line remaining time into the live producer-line view pipe; item UI consumes `line.remainingMs` instead of doing its own remaining-time math.
- Regression tests cover activated effect product requirement pause/resume, blocked delivery line view/progress, card labels, board progress, and config validation.
