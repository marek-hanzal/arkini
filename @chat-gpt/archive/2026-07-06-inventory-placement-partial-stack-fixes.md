# 2026-07-06 Inventory placement + partial stack fixes

Context: bugfix pass for two interaction regressions:

- last inventory item could fail board placement in stack-capacity edge cases;
- manual DnD of an excessive board stack into a target input consumed/animated as if the whole source stack disappeared.

Important invariants:

1. Inventory placement capacity must include existing partial board stacks, not only empty board cells. A full board can still accept a stackable inventory item if a same-item board stack has free capacity.
2. Existing `maxCount` semantics stay conservative: if board maxCount is exhausted, do not use existing stack capacity as a bypass. This preserves current placement tests and config behavior.
3. Manual board-stack input interactions must clamp consumed quantity to the target remaining capacity. The engine checkers for craft/producer input store now return a quantity-clamped `resolvedRef`; downstream consume/store must use that clamped ref.
4. Visual drop animation must not use `remove` for partial source-stack consumption. If source quantity is greater than consumed quantity, use TileEngine `boomerang`: move to target, commit, then animate source actor back with no handoff. Full consumption still uses `remove`.

Regression coverage added around:

- final inventory stack item placement;
- final inventory instance placement;
- final inventory stack item stacking into an existing board stack when the board has no empty cells;
- excessive board stack into craft input consuming only remaining recipe capacity;
- excessive board stack into producer input consuming only remaining line input capacity;
- board drop action selecting `boomerang` for partial stack input consumption.
