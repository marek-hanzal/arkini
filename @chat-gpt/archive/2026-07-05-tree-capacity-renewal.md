# 2026-07-05 — tree capacity renewal

- changed tree, double-tree, and micro-forest capacity depletion from `remove` to `replace` with `item:seed`
- depleted wood deposits now leave the seed needed to restart the water/growth cycle instead of creating a dead-end board hole
- extended config audit sustainability reasoning to accept replacement items that can regrow back into the depleted deposit using sustainable external inputs
- tree limited-deposit warnings are now gone; rock remains intentionally warned because it still has no renewal path
