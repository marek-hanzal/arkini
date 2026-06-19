# v0 proximity duration effectiveness

Implemented proximity requirements as producer/product duration modifiers.

Rules:

- Proximity keeps using Chebyshev grid distance from the target producer/building item.
- Each proximity requirement may define `durationFactor`; missing value behaves as `1`.
- Runtime finds the nearest matching board resource for each proximity requirement.
- A satisfied proximity requirement contributes `max(1, matchedDistance * durationFactor)` as a duration multiplier.
- Producer-level and product-line proximity multipliers are averaged together when both are present.
- Unsatisfied proximity requirements still block the product before duration is calculated.

Runtime integration:

- `startProducerProductFx` now creates jobs with effective duration instead of raw product duration.
- Runtime product-line views show the effective duration before start.
- Running jobs keep displaying their actual queued job duration so moving resources after start does not rewrite visible progress.
- Requirement views expose `durationFactor` and `durationMultiplier` for UI labels.

Content:

- Base lumber camp near-tree requirement now accepts distance `2` and uses `durationFactor: 1`, so a tree two cells away is valid but makes the line take `2x` time.
- The lumber camp reach upgrade now targets a distance-`3` requirement, keeping the upgrade meaningful after the base distance moved from `1` to `2`.

Validation:

- Added engine tests for distance-based duration and producer/product proximity averaging.
- Added bridge test for effective duration and requirement multiplier in runtime board view.
- Added schema test rejecting negative `durationFactor`.
