# Flow and Estimate map

Flow and Estimate analyze authored acquisition relationships. They never simulate Runtime execution and never provide an engine-valid witness. This README separates graph meaning, layout, Canvas presentation and optimistic estimation.

## Owners

| Domain | Owns | Public entrypoints |
| --- | --- | --- |
| `flow` | Acquisition facts, routes, bounded output distributions and origin projection | [`../flow/fn/createAcquisitionGraphFn.ts`](../flow/fn/createAcquisitionGraphFn.ts), [`../flow/fx/readItemOriginFlowFx.ts`](../flow/fx/readItemOriginFlowFx.ts) |
| `flow-layout` | Node metrics, deterministic layout/routing and worker boundary | [`../flow-layout/fx/layoutFx.ts`](../flow-layout/fx/layoutFx.ts), [`../flow-layout/fx/layoutInWorkerFx.ts`](../flow-layout/fx/layoutInWorkerFx.ts) |
| `flow-canvas` | Highlight/navigation projections, Canvas painting and Flow product UI | [`../flow-canvas/ui/EditorGameFlow.tsx`](../flow-canvas/ui/EditorGameFlow.tsx), [`../flow-canvas/ui/OriginFlow.tsx`](../flow-canvas/ui/OriginFlow.tsx) |
| `estimate` | Requirement topology, expected runs, route policy, witnesses, index, cache and worker | [`fn/estimateRequestsFn.ts`](fn/estimateRequestsFn.ts), [`fn/estimateItemCatalogFn.ts`](fn/estimateItemCatalogFn.ts), [`atom/ItemEstimateCacheAtom.ts`](atom/ItemEstimateCacheAtom.ts) |

## Dependency shape

The stable core direction is:

```text
flow-canvas → flow-layout → flow
estimate/{fn,type} → flow/{fn,type}
```

- Flow core reads authored config, Item and production contracts. Its only cross-domain behavior dependency in that set is the canonical authored-Line read from `production-line`.
- Flow Layout consumes Flow values but owns no relation meaning. Flow Canvas consumes both and owns no graph or geometry truth.
- Estimate core consumes Flow's acquisition graph. It imports no renderer, route, Electron or runtime gameplay owner.
- The top-level `estimate ↔ item-authoring` pair is presentation/shared-search composition: Estimate reuses the Item search policy and list row, while Item detail embeds an Estimate section. It is not recursive analysis behavior.
- Project Authoring warms or presents Estimate; Estimate worker contracts use the immutable Project type. Project persistence never depends on an Estimate result.

Do not collapse the four roots into a `flow` superdomain. Their change reasons and platform boundaries are different.

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

Flow display takes a separate branch:

```text
authored acquisition graph
→ origin projection
→ worker layout
→ Canvas projection and painting
```

## Estimate semantics

- Estimate is optimistic static authored-dependency analysis using bounded output distributions and expected first-hitting time.
- Indivisible deterministic batches round up; stochastic outputs retain authored probability.
- Route selection is deterministic and quantity-aware. Stable route identity breaks equal-cost ties.
- Alternative refinement is bounded where finite roots or co-products invalidate the locally ranked route set; this is not exhaustive combinatorial optimization.
- Additive consumed demand sums. Reusable one-time and ongoing requirements share by maximum. Concurrent route demand uses the larger consumed-plus-reusable requirement.
- A finite root is credited once across the witness. One selected co-product operation is charged once.
- Independent witness branches overlap on the optimistic critical path.
- Unsupported bounded distribution state returns `partial`; it never invents a scalar answer.
- Cycles and dead ends are diagnostics. Runtime rules, placement, concrete identity packing, renewable capacity and engine execution are outside the model.

## Revision and UI boundaries

Editor entry may warm one immutable Estimate revision. An Estimate surface captures the current revision when entered and never combines a result with a later project config. Saving the project alone does not mutate an already captured result.

Query, filtering, sorting and selection belong to [`fn/createItemEstimateIndexFn.ts`](fn/createItemEstimateIndexFn.ts) and [`fn/selectItemEstimateIndexFn.ts`](fn/selectItemEstimateIndexFn.ts). React binds controls and renders selected rows; it does not filter the raw catalog or recompute estimates per page.

## Changing this island?

Likely affected:

- `flow` regression proofs when acquisition facts, line inputs, charges, outputs or co-products change.
- Estimate topology, routes, demand sharing, diagnostics, witness projection and cache identity.
- Flow Layout only when graph shape or layout inputs change.
- Flow Canvas only when origin/highlight/navigation projection changes.
- Editor Item detail and project warmup at their exact embedding boundaries.

Usually not affected:

- Runtime production execution, Tick or save behavior. Similar vocabulary does not make Estimate a simulator.
- Project filesystem transactions, Versions or MCP mutation authority.
- Arkpack encoding, provenance and installed-game lifecycle.

An authored schema or production semantic change can affect both Runtime and analysis, but each owner needs its own proof. Never use an Estimate test as evidence for engine behavior.
