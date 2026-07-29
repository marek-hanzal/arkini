# Multi-slot experiment evidence

This document is branch evidence for #438, not shipped architecture documentation.
The implementation baseline is `0.5.x` at `5bf54cad`. The playable fixture is
[`game/demo`](game/demo); its exact route is documented in
[`game/demo/README.md`](game/demo/README.md).

## Current evaluation state

The code, authored-content evidence, independent review, and isolated Electron
playthrough are complete. The product verdict is **DEFER**: the architecture is
viable, but the current content and presentation do not yet prove enough spatial
gameplay value to justify permanently carrying the added interaction complexity.

The original “do not rebalance official content” constraint was superseded by the
product-owner instruction to make constructed official buildings `2 × 2` on this
branch. That content is reference data for the experiment, not an acceptance
verdict.

## Playable experiment

The demo compiler proof is
[`test/source/MultiSlotDemoContent.test.ts`](test/source/MultiSlotDemoContent.test.ts).
It verifies the completed config, implicit and explicit `1 × 1`, `2 × 2`, `2 × 3`,
`3 × 1`, and `3 × 3` definitions, stackable and non-stackable representatives,
passive-storage fixtures, and the authored coordinates that make these routes real:

- the initial Board has no free `3 × 3` candidate;
- clearing the two adjacent pegs opens the intended `3 × 3` area;
- a `3 × 1` drop at `(1, 3)` initially collides with two distinct identities;
- the extra cell at `(6, 0)` blocks target-anchor placement of the `3 × 1` result
  replacing the `2 × 2` merge target;
- the large `2 × 3` owner produces a Board-only `3 × 3` output;
- that owner's line has an authored `enable` rule whose Board query requires a
  `close` Survey Peg; the peg at `(2, 3)` is exactly one Chebyshev step from the
  nearest corner of the owner's rectangle, so moving it makes edge-based
  availability directly observable;
- two `2 × 2` stackable units begin compacted into one Inventory slot, and an
  explicit `1 × 1` item begins in Toolbar.

## Completed authority ledger

“Unchanged” means callers retain their operation-level contract and delegate the
new geometry to a narrow owner; it does not mean the call site text is byte-identical.

| Concern              | Owner before experiment                        | Generalized input                                          | Old assumption removed                        | Callers unchanged                                     | Obsolete path deleted                                           |
| -------------------- | ---------------------------------------------- | ---------------------------------------------------------- | --------------------------------------------- | ----------------------------------------------------- | --------------------------------------------------------------- |
| Definition/default   | `BaseItemSchema`, compiler                     | canonical effective footprint                              | implicit definition repeatedly meant one cell | Yes; item variants still compose the base schema      | downstream optional-size fallback was not introduced            |
| Board geometry       | grid/location geometry                         | Board anchor + rectangle                                   | position equals area                          | Yes; callers ask grid leaves for geometry             | inline rectangle math replaced by grid leaves                   |
| Occupancy/invariants | claims + runtime checks                        | derived complete surface cells                             | one item ↔ one cell                           | Yes; runtime state still stores one identity/location | anchor-only claim/bounds checks removed                         |
| New quantities       | material placement plan/apply                  | complete candidate rectangle + evolving claims             | one empty anchor is enough                    | Yes; quantity normalization remains material-owned    | batch double-booking through a static empty-anchor list removed |
| Existing returns     | exact-location selector + `placeRuntimeItemFx` | complete exclusive rectangle and captured origin           | one exclusive cell                            | Yes; lifecycle owners still return one exact identity | point-origin reconstruction after removal removed               |
| Direct drop          | preview + `dropItemFx` leaves                  | requested anchor, hit cell, collision identities/revisions | target cell describes all overlap             | Yes; command remains the preview/commit boundary      | renderer-authorized or sole-target collision truth removed      |
| Swap                 | current commit/write                           | bounded ordered relocated identities                       | pair always exhausts collisions               | Yes; drop still commits one atomic transition         | pair-only drop assumption removed; destination-less direct exchange remains as a compatibility command |
| Merge                | current merge transition                       | target-first exact result placement                        | replacement always fits target cell           | Yes; merge semantics remain merge-owned               | unconditional replacement-at-anchor removed                     |
| Completion           | current completion transition                  | generalized output and exact return placement              | one-cell output feasibility                   | Yes; completion retry owner is unchanged              | anchor-only output admission removed                            |
| Isolation            | current isolation transition                   | generalized exact remainder placement                      | remainder needs one cell                      | Yes; isolation remains quantity/state-owned           | point-only remainder placement removed                          |
| Gameplay distance    | distance/query owners                          | two Board rectangles                                       | anchor-only Chebyshev                         | Yes; selectors still request semantic distance bands  | inline anchor distance removed                                  |
| Placement order      | Board ordering owners                          | owner/candidate rectangles                                 | anchor-only Manhattan                         | Yes; callers still request standard order             | inline point-distance ordering removed                          |
| Pixi                 | bridge + retained scene owners                 | projected rectangular bounds/AABBs                         | actor equals one cell                         | Yes; Pixi consumes bridge facts                       | one-cell hit/index removed; exact-two optimistic cue remains as a rectangular async-race path |

No runtime occupied-cell collection, feature-level coordinator, recursive packing,
or engine/Pixi shared mutable occupancy was added.

## Focused proof index

Each proof below is a focused test file; individual test names make the claimed
invariant explicit.

- **P1 — definition/default and content:** `test/item/schema/BaseItemSchema.test.ts`,
  `test/compiler/fx/compileGameSourcesFx.test.ts`,
  `test/source/MultiSlotDemoContent.test.ts`
- **P2 — rectangle geometry:** `test/grid/fx/boardRectangleFx.test.ts`,
  `test/grid/fx/readEffectiveGridFootprintFx.test.ts`,
  `test/grid/fx/readBoardRuntimeItemRectangleFx.test.ts`
- **P3 — claims and runtime admission:**
  `test/location/read/readGridLocationClaimsFx.test.ts`,
  `test/location/read/readGridLocationOccupantsFx.test.ts`,
  `test/runtime/check/checkRuntimeFx.test.ts`,
  `test/placement/fx/readEmptyLocationsFx.test.ts`
- **P4 — material batching:** `test/placement/fx/planSpawnPlacementFx.test.ts`,
  `test/placement/fx/pureStackTargets.test.ts`
- **P5 — Delivery lease:** `test/delivery/write/settleItemDeliveryFx.test.ts`
- **P6 — move, preview, swap, and storage commit:**
  `test/runtime/write/dropItemFx.test.ts`,
  `test/runtime/write/dropItemInputStoreFx.test.ts`,
  `test/runtime/write/dropItemStackFx.test.ts`
- **P7 — merge and isolation:** `test/merge/write/mergeItemsFx.test.ts`,
  `test/merge/write/mergeItemsFx.atomicity.test.ts`,
  `test/merge/write/mergeItemsFx.lifecycle.test.ts`,
  `test/merge/write/mergeItemsFx.event.test.ts`
- **P8 — completion and exact returns:**
  `test/job/fx/completeJobTransitionFx.craft.test.ts`,
  `test/job/fx/reservedMaterialLifecycle.test.ts`,
  `test/input/fx/releaseOwnerInputsFx.identity.test.ts`
- **P9 — scope and storage:** `test/job/MultiSpaceOwnershipGraph.test.ts`,
  `test/job/OwnerInventoryContract.test.ts`,
  `test/input/write/itemDetailLineInputActions.test.ts`
- **P10 — semantic distances and placement order:**
  `test/query/fx/queryFx.test.ts`,
  `test/placement/fx/orderBoardLocationsFx.test.ts`,
  `test/placement/fx/orderStackItemsFx.test.ts`
- **P11 — committed bridge facts and Pixi geometry:**
  `test/bridge/tile/readTileDeliveriesFx.test.ts`,
  `test/bridge/tile/readTileMotionCuesFx.test.ts`,
  `test/ui/pixi/PixiGridDropFeedback.test.ts`,
  `test/ui/pixi/PixiLiveActorContactPose.test.ts`,
  `test/ui/pixi/PixiMainSceneDragController.test.ts`,
  `test/ui/pixi/PixiMainSceneSurface.test.ts`,
  `test/ui/pixi/PixiMainSceneDropPresentation.test.ts`,
  `test/ui/pixi/PixiTileMotionRuntime.test.ts`
- **P12 — one-cell parity:** all unchanged focused operation suites above plus the
  omitted-footprint compiler proof in P1. No separate legacy planner exists.

## Behavioral invariant matrix

Abbreviations refer to the proof index. `N/A` means the invariant is outside that
operation family, not that it is untested.

| Invariant                          | start / hydration | material placement | completion / lifecycle | existing return | direct move | bounded swap | merge  | stack / isolation | storage / spaces | distance / effects | Pixi / motion |
| ---------------------------------- | ----------------- | ------------------ | ---------------------- | --------------- | ----------- | ------------ | ------ | ----------------- | ---------------- | ------------------ | ------------- |
| one exact identity                 | P1, P3            | P4                 | P8                     | P8              | P6          | P6           | P7     | P7                | P9               | N/A                | P11           |
| derived occupancy                  | P3                | P3, P4             | P3, P8                 | P3, P8          | P3, P6      | P3, P6       | P3, P7 | P3, P7            | P3, P9           | P2, P10            | P11           |
| complete bounds / overlap          | P3                | P3, P4             | P3, P8                 | P3, P8          | P3, P6      | P3, P6       | P3, P7 | P3, P7            | P3, P9           | P2                 | P11           |
| deterministic order / random owner | P12               | P4, P10            | P8, P10                | P8, P10         | P6          | P6           | P7     | P7, P10           | P9               | P10                | P11           |
| purity and quantity                | P12               | P4                 | P8                     | P8              | P6          | P6           | P7     | P7                | P9               | N/A                | P11           |
| scope and space                    | P3                | P4, P9             | P8, P9                 | P8, P9          | P6, P9      | P6, P9       | P7, P9 | P7, P9            | P9               | P10                | P11           |
| stale preview / commit truth       | P3                | P4                 | P8                     | P8              | P6          | P6           | P6, P7 | P6, P7            | P6, P9           | N/A                | P11           |
| one candidate / atomic rollback    | P3                | P4                 | P8                     | P8              | P6          | P6           | P7     | P7                | P6, P9           | N/A                | P11           |
| typed errors / events              | P3                | P4                 | P8                     | P8              | P6          | P6           | P7     | P7                | P9               | P10                | P11           |
| `1 × 1` parity                     | P1, P12           | P12                | P12                    | P12             | P12         | P12          | P12    | P12               | P12              | P12                | P12           |

### High-risk proof coverage

- Delivery origins reserve the exact old Board rectangle and one storage slot: P5.
- A multi-output batch cannot double-book its own candidate cells: P4.
- Blocked completion retains exact state, publishes nothing, and replays its
  deterministic output on retry: P8.
- Merge preserves the target ID, tries the target anchor, falls back through
  standard exact placement, and rolls back atomically: P6, P7.
- Swap fixes the source at the requested anchor, commits only the previewed initial
  collision set, orders the explicit target first, preserves exact displaced state
  and ownership, and rejects stale/unpreviewed collisions without mutation: P6,
  specifically:
  - `preserves displaced identity, quantity, state, and its owned subtree`;
  - `rejects a destination leased by a non-relocatable Delivery origin`;
  - `reuses released source space for the explicit target before other relocations`;
  - `keeps deterministic target-first greedy relocation without backtracking`;
  - `rolls back runtime revisions, events, and item order when a later relocation fails`.
- Board and storage direction combinations preserve their existing scope contract:
  P6, P9.
- Committed additional relocations become canonical bridge cues and ordered Pixi
  motion; Pixi does not derive them from a runtime diff: P11.
- Chebyshev gameplay proximity and Manhattan placement ordering are separate
  primitives and focused proofs: P2, P10.

These P6 proofs exercise the final command boundary with hydrated or spawned valid
runtime fixtures. The rollback proof compares the complete committed-transition
snapshot, so an attempted early relocation cannot leak a revision, event, item-order
change, or partial runtime write.

## Fork search and narrow-code review

Commands used from the repository root:

```sh
rg -l '\bfootprint\b|FootprintSchema' src -g '*.ts' | sort
rg -n 'MultiSlot|multiSlot|multi-slot|multi slot' src -g '*.ts'
git diff -U0 5bf54cad -- src | rg '^\+.*(footprint|\.width|\.height|width:|height:)'
git diff -U0 5bf54cad -- src | rg '^\+.*if .*footprint|^\+.*footprint.*[><=!]=? *[12]'
rg -n 'occupied(Cell|Cells|Location|Locations)|footprint' \
  src/engine/state/schema/StateItemSchema.ts \
  src/engine/runtime/schema/RuntimeItemSchema.ts
```

Snapshot during integration review:

- 33 production files mention the canonical footprint contract;
- 0 production hits use `MultiSlot`, `multiSlot`, `multi-slot`, or `multi slot`;
- 0 runtime-state fields persist occupied cells or footprint;
- the only dimension comparisons found in the added production diff are bounded
  rectangle-cell traversal loops, not feature-size behavior forks.

Every footprint-bearing production file belongs to one allowed narrow group:

- definition: `BaseItemSchema`, `FootprintSchema`;
- grid geometry: `BoardRectangleSchema` and the `src/engine/grid/fx` rectangle leaves;
- claims/admission: `readGridItemLocationsFx`, placement owners, and query ordering;
- bridge projection: tile actor/read/motion leaves;
- presentation: Pixi actor, drag, magnet, motion, and scene-surface geometry.

The exact 33-file list is intentionally generated by the first command rather than
hand-maintained.

## Structural and performance evidence

The following counts are code-shape inventory, not performance claims. They were
captured against `5bf54cad` with `git grep` for the baseline and `rg` for the working
tree:

| Concern / search token                    | Baseline | Experiment snapshot | Interpretation                                                  |
| ----------------------------------------- | -------: | ------------------: | --------------------------------------------------------------- |
| `readEmptyLocationsFx`                    |       11 |                  13 | existing placement owner reused; no parallel multi-slot planner |
| `readGridLocationClaimsFx`                |       18 |                  13 | occupancy authority narrowed rather than duplicated             |
| `expectedCollisions\|relocations`         |        0 |                  77 | explicit preview/commit and presentation facts added            |
| rectangle Chebyshev owner or `distanceFx` |        5 |                  11 | shared rectangle primitive added under existing distance owner  |
| scene location-index tokens               |        4 |                   4 | no second scene occupancy index                                 |
| magnet/interaction-candidate owner tokens |        8 |                   8 | existing local-candidate owners retained                        |
| production footprint-bearing files        |        0 |                  33 | footprint propagation is inspectable and bounded                |
| feature-level multi-slot names            |        0 |                   0 | no coordinating feature framework                               |

Focused deterministic checks run for this integration slice:

```text
npm run game:validate
npm run game:validate -- game/demo
npm test -- --run \
  test/source/MultiSlotDemoContent.test.ts \
  test/source/readGameSourceFilesFx.test.ts \
  test/compiler/fx/compileGameSourcesFx.test.ts
npm test -- --run \
  test/runtime/write/dropItemFx.test.ts \
  test/source/MultiSlotDemoContent.test.ts
npm run typecheck:test
```

Result at capture: both game directories validate; the compiler/source/content slice
passes 3 files / 16 tests; the final drop/content proof slice passes 2 files / 35
tests; test TypeScript compilation passes.

## Electron observations

The final branch was launched in an isolated Electron user-data directory and the
unsigned `game/demo` Arkpack was played on its `8 × 6` Board.

- `2 × 3`, `2 × 2`, `3 × 1`, and `3 × 3` actors occupied and hit-tested their full
  rectangles; storage surfaces remained one slot.
- The `3 × 1` beam preview preserved the grabbed cell, drew the requested rectangle,
  highlighted the explicit hit cell, and overlaid additional collision cells from
  the engine preview. The compiled-game integration proof committed exactly two
  relocations at requested anchor `(1, 3)`.
- Ordinary rectangular movement remained stable. Focused proofs cover resize
  retargeting, dense local magnet lookup, incremental scene-index updates, delivery
  portals, spawn, input, stack, legacy optimistic swap, and finalization.
- The retained scene index refreshes only affected identities after transitions;
  a full rebuild is reserved for mount or Game replacement. Magnet candidates are
  obtained from padded local cells rather than a full actor scan.
- No renderer errors or visible aspect-ratio snaps were observed during the manual
  drag pass. These are observations, not timing thresholds.
- Readability is not yet product-ready: reused square art and truncated labels make
  footprint size hard to infer while idle. The grid and drag feedback make geometry
  clear during interaction, but official `2 × 2` authoring materially increases
  Board density and still needs content/layout iteration.

## Product verdict gate

```text
DEFER
→ architecture is viable but content/product timing is not
```

The experiment should not be merged merely because its checks pass. Keep the
generalized implementation available on this branch, then revisit integration when
content density, idle footprint readability, and the spatial gameplay payoff have
been designed together.
