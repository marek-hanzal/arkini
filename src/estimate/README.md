# Acquisition and Estimate map

The shared `flow` domain and Estimate analyze authored acquisition relationships. They never simulate Runtime execution and never provide an engine-valid witness. The Editor has no Flow visualization; the acquisition graph remains the shared authority for Estimate, Connections, and MCP relation queries.

## Owners

| Domain | Owns | Public entrypoints |
| --- | --- | --- |
| `flow` | Acquisition facts, routes, bounded output distributions and origin projection | [`../flow/fn/createAcquisitionGraphFn.ts`](../flow/fn/createAcquisitionGraphFn.ts), [`../flow/fn/readItemOriginRelationsFn.ts`](../flow/fn/readItemOriginRelationsFn.ts) |
| `estimate` | Requirement topology, expected runs, route policy, witnesses, index, cache and worker | [`fn/estimateRequestsFn.ts`](fn/estimateRequestsFn.ts), [`fn/estimateItemCatalogFn.ts`](fn/estimateItemCatalogFn.ts), [`atom/ItemEstimateCacheAtom.ts`](atom/ItemEstimateCacheAtom.ts) |

## Dependency shape

The stable core direction is:

```text
estimate/{fn,type} → flow/{fn,type}
```

- Flow core reads authored config, Item and production contracts. Its only cross-domain behavior dependency in that set is the canonical authored-Line read from `production-line`.
- Estimate core consumes Flow's acquisition graph. It imports no renderer, route, Electron or runtime gameplay owner.
- The top-level `estimate ↔ item-authoring` pair is presentation/shared-search composition: Estimate reuses the Item search policy and the shared artwork catalog card, while Item detail embeds an Estimate section. It is not recursive analysis behavior.
- Project Authoring warms or presents Estimate; Estimate worker contracts use the immutable Project type. Project persistence never depends on an Estimate result.

Keep graph facts in `flow` and optimistic acquisition policy in `estimate`; their contracts remain distinct.

## Analysis flow

```text
immutable Project revision
→ createAcquisitionGraphFn
→ bounded output and availability facts
→ createEstimateTopologyFn
→ quantity-aware route selection
→ bounded alternative refinement
→ shared finite-root/co-product accounting
→ normalized witness projection
→ immutable catalog/index cached for that revision
```

Editor Connections uses [`readItemConnectionFactsFn`](../flow/fn/readItemConnectionFactsFn.ts) to project direct authored inputs and outputs in either direction. Each item retains its source paths (line, action, merge, Units, or Clock, plus exact input, rule/condition, and output set/roll/candidate/drop positions); this lookup does not evaluate runtime availability or Estimate reachability.

Item Chain is a separate authored consequence projection in [`readItemChainsFn`](../item-chain/fn/readItemChainsFn.ts), available in Item detail and through the read-only MCP `item_chain` tool. It starts only the selected item's own directional merges and Clock, then traverses Clock expiry and Clock-selected line output. It never follows intermediate merges, other production lines or input acquisition. Each no-Clock output is terminal; periodic occurrences, roll alternatives, retained participants, finite exploration limits and cycles remain explicit. It does not consume or alter the acquisition graph, Estimate policy, runtime schedules or project persistence.

## Estimate semantics

- Estimate is optimistic static authored-dependency analysis using bounded output distributions and expected first-hitting time.
- Indivisible deterministic batches round up; stochastic outputs retain authored probability.
- Route selection is deterministic and quantity-aware. Stable route identity breaks equal-cost ties.
- Alternative refinement is bounded where finite roots or co-products invalidate the locally ranked route set; this is not exhaustive combinatorial optimization.
- Additive consumed demand sums. Reusable one-time and ongoing requirements share by maximum. Concurrent route demand uses the larger consumed-plus-reusable requirement.
- A finite root is credited once across the witness. One selected co-product operation is spent once.
- Independent witness branches overlap on the optimistic critical path.
- Unsupported bounded distribution state returns `partial`; it never invents a scalar answer.
- Clock lines remain ordinary authored Flow relations, and finite Clock `onExpire` uses the shared expiry projection. Automatic-only lines without both an interval and the Clock flag, and permanently disabled automatic schedules, have no Estimate execution route.
- An unbounded automatic Clock line uses the larger of interval and line runtime as its optimistic action cadence. Initial impulse delay, queue contention and conditional runtime changes remain outside this lower bound; interactive production retains ordinary line timing.
- Finite production-owner lifetime and expiry settlement return `partial` with an explicit diagnostic. A passive finite-lifetime item has no production to drain, so its expiry retains ordinary bounded acquisition timing. Estimate does not claim unlimited output from a finite Clock or simulate its draining jobs.
- Cycles and dead ends are diagnostics. Runtime rules, placement, concrete identity packing, renewable capacity and engine execution are outside the model.

## Revision and UI boundaries

Editor entry may warm one immutable Estimate revision. An Estimate surface captures the current revision when entered and never combines a result with a later project config. Saving the project alone does not mutate an already captured result. The Items toolbar always offers Refresh to capture the latest published config explicitly; stale results only highlight that control, without inserting a notice above the grid.

Query, filtering, sorting and selection belong to [`fn/createItemEstimateIndexFn.ts`](fn/createItemEstimateIndexFn.ts) and [`fn/selectItemEstimateIndexFn.ts`](fn/selectItemEstimateIndexFn.ts). React binds controls and renders selected rows; it does not filter the raw catalog or recompute estimates per page.

The Items grid is the single catalog for authoring and Estimate: it combines draft/search filtering with name or canonical Estimate ordering through [`selectItemCollectionFn`](../item-authoring/fn/selectItemCollectionFn.ts). Its timing and demand projection is keyed by item UID; the per-item Estimate tab remains the route detail. It shows placeholders while results are unavailable or its live config differs from the captured Estimate config.

## Changing this island?

Likely affected:

- `flow` regression proofs when acquisition facts, line inputs, units, outputs or co-products change.
- Estimate topology, routes, demand sharing, diagnostics, witness projection and cache identity.
- Editor Item detail and project warmup at their exact embedding boundaries.

Usually not affected:

- Runtime production execution, Tick or save behavior. Similar vocabulary does not make Estimate a simulator.
- Project filesystem transactions, Versions or MCP mutation authority.
- Arkpack encoding, provenance and installed-game lifecycle.

An authored schema or production semantic change can affect both Runtime and analysis, but each owner needs its own proof. Never use an Estimate test as evidence for engine behavior.

Item Chain uses the default `maxDepth = 5` in [`readItemChainsFn`](../item-chain/fn/readItemChainsFn.ts); there is no depth selector. One merge or Clock operation consumes one step. If a chain stops too early with `Depth limit`, revisit this default first. The separate 400-expansion safety budget and cycle detection still bound exploration.

MCP [`readItemChainTextFx`](../authoring-mcp/tool/readItemChainTextFx.ts) calls the same projection with its default depth and formats every outcome and nested step as text. Use `item_chain({ itemId })` to inspect transformations and Clock consequences, `item_input`/`item_output` for general relations, and `item_estimate` for acquisition planning. The tool has no depth input, adds no traversal or pagination, and preserves local quantities, timing, alternative sets, rolls, candidate weights, conditions and incomplete states.
