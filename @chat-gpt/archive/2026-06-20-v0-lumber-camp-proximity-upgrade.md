# Lumber camp proximity upgrade tuning

Completed 2026-06-20.

- Tuned `upgrade:lumber-camp-1-reach` into `Lumber Camp I Forest Logistics`.
- Tier 1 is now pure base speed: `product.duration.add` `-100ms` for `product:lumber-camp-1`.
- Tier 2 no longer removes the forest proximity requirement.
- Added `requirement:lumber-camp-1-near-tree-3-efficient` with distance `3` and `durationFactor: 0.75`.
- Tier 2 now sets the producer requirement to that efficient proximity requirement, so the camp can still use a farther tree while taking a milder distance penalty.
- Compiled `game/arkini.game.json` from the source JSON package.
