# Pixi renderer map

This directory is Arkini's retained gameplay presentation layer. React still owns routes,
pages, menus, modals, and Item Detail. The engine remains the only owner of gameplay truth;
Pixi consumes bridge contracts and never decides whether a move, swap, stack, production, or
storage action is valid.

Start with `scene/createPixiMainSceneRuntimeFx.ts` for Board + Toolbar and
`scene/createPixiInventorySceneRuntimeFx.ts` for Inventory. They are the composition roots for
all scene-local owners.

## Ownership

| Owner | Responsibility |
| --- | --- |
| `PixiGameProvider.tsx` | Route-local textures, interaction cancellation, and cross-scene handoffs |
| `runtime/createPixiApplicationOwnerFx.ts` | One canvas, Pixi application, resize lifecycle, and demand renderer |
| `scene/*Surface*` | Layout, layers, hit geometry, masks, palette, and drop-feedback paint |
| `actor/*ActorStore*` | Retained display-object identity for one canvas |
| `scene/createPixiMainSceneReconcilerFx.ts` | Canonical actor reconciliation and presentation entry/exit |
| `motion/createPixiTileMotionRuntimeFx.ts` | Ordered cue lanes, animation claims, transient payloads, and cue settlement |
| `drag/*DragController*` | One pointer gesture and its frozen source/release facts |
| `drop/createPixiMainSceneDropPresentationFx.ts` | Accepted-drop presentation facts until canonical settlement |
| `animation/createPixiAnimationDriverFx.ts` | Motion controls and springs; the only interpolation clock |
| `animation/createPixiActorAnimatorFx.ts` | Interruptible, keyed writes to actor presentation channels |

Main-scene and Inventory actors are intentionally separate: Pixi display objects cannot move
between canvases. `handoff/createTileSceneHandoffStoreFx.ts` transfers only short-lived source
geometry. The receiving scene still resolves identity and outcome from a committed transition.

## Data flows

Canonical presentation:

```text
GameEngine committed transition
→ scene runtime
→ surface receives the exact transition snapshot
→ reconciler projects bridge-level actors and motion cues
→ actor store / motion runtime mutate retained presentation
→ demand frame invalidation
```

Pointer release:

```text
drag controller
→ bridge preview using canonical source and target facts
→ freeze fresh release-time facts
→ bridge command
→ command result + current committed transition
→ drop presentation / reconciler / motion cues
```

The renderer may lag, retain, hide, or animate committed facts, but it must not manufacture a
gameplay outcome. Missing visual identities or handoffs degrade to ordinary reconciliation.

## Interaction contract

- Click performs the tile's immediate primary action.
- Shift+click opens Item Detail.
- Crossing the drag threshold changes the same pointer gesture from activation to drag.
- Drop validity and magnetic attraction come from bridge previews, never from Pixi geometry or
  renderer-side compatibility rules.
- Main-scene overlays block and cancel local interaction; route teardown closes either scene's
  gesture owner. Submitted engine commands are allowed to settle through their canonical result.

## Lifecycle invariants

- Motion supplies interpolation only. Pixi owns display objects and Effect-owned runtime objects
  own acquisition, cancellation, completion, and teardown.
- Rendering is demand-driven. Every visual mutation invalidates the scene; no idle Pixi ticker or
  second animation loop may run.
- Teardown stops subscriptions and interactions before destroying actors, layers, or the
  application they reference.
- Animation keys are ownership keys. Reusing a key must interrupt the previous writer; opacity,
  running-state alpha, transforms, and replacement fades must not gain competing writers.
- Async texture completion is generation-guarded, and route-level texture ownership outlives both
  alternating canvases.

## Where to change behavior

| Change | Start here |
| --- | --- |
| Scene composition or teardown | `scene/createPixi*SceneRuntimeFx.ts` |
| Canonical actor appearance or identity | `actor/` and `scene/createPixiMainSceneReconcilerFx.ts` |
| Drag, click, Shift+click, or drop release | `drag/` |
| Move, swap, stack, spawn, or replacement choreography | `motion/` and `scene/runPixiMainSceneReplacementsFx.ts` |
| Cross-canvas Inventory release | `PixiInventorySurface.tsx` and `handoff/` |
| Hit testing, slot geometry, or masks | `scene/*Surface*`, `layout/`, and `grid/` |
| Magnetic response | `magnet/`; eligibility must continue to come from the bridge |
| Frame scheduling or interpolation | `runtime/` and `animation/` |

Focused regression tests live under `test/ui/pixi`. Update or add an invariant-named test when an
ownership, interruption, settlement, remount, or teardown contract changes.
