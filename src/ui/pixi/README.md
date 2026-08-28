# Pixi renderer map

Pixi is Arkini's retained gameplay presentation owner. The engine remains gameplay truth; React owns routes, pages, menus, and Item Detail. Start at `scene/createPixiMainSceneRuntimeFx.ts` for Board + Toolbar and `scene/createPixiInventorySceneRuntimeFx.ts` for Inventory.

## Owners

| Area | Owner |
| --- | --- |
| Canvas, resize, demand rendering | `runtime/createPixiApplicationOwnerFx.ts` |
| Surface geometry, layers, masks, feedback | `scene/*Surface*` and `layout/` |
| Retained identity within one canvas | `actor/*ActorStore*` |
| Canonical reconciliation | `scene/createPixiMainSceneReconcilerFx.ts` |
| Pointer gesture and frozen release facts | `drag/*DragController*` |
| Drop submission/presentation | `drop/` |
| Engine-delivery presentation | `delivery/` |
| Cue sequencing and handoffs | `motion/createPixiTileMotionRuntimeFx.ts` |
| Interpolation/springs | `animation/createPixiAnimationDriverFx.ts` |
| Typed actor-channel writes | `animation/createPixiActorAnimatorFx.ts` |

Main and Inventory actors are separate because display objects cannot cross canvases. Cross-canvas handoff carries consume-once origin geometry keyed by the releasing actor; the receiving scene still derives identity/outcome from committed engine facts.

## Flows

```text
committed transition
→ bridge projection + current presentation claims
→ reconciler plan
→ retained actor allocation/reconciliation
→ motion/animation channels
→ demand-frame invalidation
```

```text
pointer gesture
→ fresh bridge preview
→ freeze source/target/release facts
→ one public atomic engine command
→ reconcile its result with the latest committed transition
```

Delivery endpoints, generation, phase, and remaining time are engine state. Tick owns countdown and settlement even when no scene or geometry exists; Pixi may retarget, freeze, or hide presentation but never admits input or starts work.

## Interaction

- Board/Toolbar left click runs the primary action; `Ctrl+left click` fills remaining default-line queue capacity; `Shift+left click` splits a Board stack; right click opens Item Detail.
- Inventory left click releases the item; right click opens Item Detail.
- Crossing the drag threshold converts the same pointer gesture into drag. The retained actor is reparented; there is no ghost, screenshot, duplicate tile, or pointer-frequency React render.
- Bridge preview owns validity and magnetic eligibility. Pixi geometry never infers merge, stack, storage, swap, or placement behavior.
- Overlays block/cancel local interaction. A submitted engine command may settle canonically after route/gesture teardown.

## Invariants

- One reconciler owns actor allocation, visual generations, store mutation, and presentation-claim settlement.
- One animator owns each typed presentation channel; ownership keys may cancel work but cannot create a competing writer. Motion is the only interpolation clock, and the Pixi ticker is not a second loop.
- Root pose, grab offset, lifecycle, crowd, particles, and visual revision remain independent channels. Tuning belongs in implementation, not this contract.
- Actor stores follow exact runtime identities within their canvas. Pure canonical placement may normalize identity; presentation never assumes continuity from intent.
- Hydration presents the current snapshot without replaying historical events. Only later event batches drive choreography.
- Async texture completion is generation-guarded. A complete current visual remains until a complete replacement is ready; superseded work cannot publish or destroy the surviving generation.
- Teardown cancels gestures, subscriptions, animation, and async readiness before destroying actors, layers, textures, or the application.

## Navigation

| Change | Start at |
| --- | --- |
| Scene composition/teardown | `scene/createPixi*SceneRuntimeFx.ts` |
| Actor identity/appearance | `actor/` + main reconciler |
| Click/drag/drop | `drag/` + `drop/` |
| Spawn/swap/stack/replacement cues | `motion/` |
| Autofill delivery | `delivery/`; canonical behavior is `engine/delivery/` + Tick |
| Inventory handoff | `PixiInventorySurface.tsx` + main Inventory opener |
| Geometry/hit testing | `scene/*Surface*`, `layout/`, `grid/` |
| Magnetic response | `magnet/` |
| Frame/interpolation | `runtime/` + `animation/` |

Focused Pixi tests live under `test/ui/pixi`.
