# Game Scene map

Game Scene is Arkini's concrete retained Pixi executor. `src/tile-presentation` owns semantic actor projections, `src/tile-rendering` owns native actors and animation capabilities, `src/tile-motion` owns deterministic playback, and `src/tile-interaction` owns pointer gestures plus activation and drop execution.

The engine remains gameplay truth. React owns routes, pages and menus; `src/item-detail` owns Item Detail dialog composition. Start at `fx/createMainRuntimeFx.ts` for Board + Toolbar and `fx/createInventoryRuntimeFx.ts` for Inventory.

The root has only direct grammar layers: `ui/` for React canvas composition, `fx/` for lifecycle and retained mutation, `fn/` for shared explicit-input calculations, `service/` for readonly scene capabilities, and `type/` for cross-owner geometry values. No layer contains semantic filing subdirectories.

## Owners

| Area | Owner |
| --- | --- |
| Canvas, resize, demand rendering | `src/tile-rendering/fx/createApplicationOwnerFx.ts` |
| Semantic actors, feedback, replacements, motion intents | `src/tile-presentation/{type,fn,fx}` |
| Native actors, visuals, readiness and particles | `src/tile-rendering/{type,service,fn,fx}` |
| Surface geometry, layers, masks, feedback | `fx/create*SurfaceFx.ts`, `fx/draw*Fx.ts`, and `fn/read*LayoutFn.ts` |
| Main retained identity | `src/tile-rendering/service/MainActorStore.ts` |
| Inventory retained identity and reconciliation | `service/InventoryActorStore.ts` + `fx/createInventoryActorStoreFx.ts` |
| Canonical reconciliation | `fx/createMainReconcilerFx.ts` |
| Pointer gestures, activation and frozen release facts | `src/tile-interaction/{atom,fn,fx,type}` |
| Drop submission/presentation | `src/tile-interaction/fx/createDrop*Fx.ts` |
| Engine-delivery presentation | `fx/readTileDeliveriesFx.ts` + `fx/createDeliveryRuntimeFx.ts` |
| Cue lanes, choreography, magnetic response and handoffs | `src/tile-motion/{service,type,fn,fx}` |
| Interpolation/springs | `src/tile-rendering/fx/createAnimationDriverFx.ts` |
| Typed actor-channel writes | `src/tile-rendering/fx/createActorAnimatorFx.ts` |

Main and Inventory actors are separate because display objects cannot cross canvases. Cross-canvas handoff carries consume-once origin geometry keyed by the releasing actor; the receiving scene still derives identity/outcome from committed engine facts.

## Dependency shape

- Game Scene executes Tile Presentation, Rendering, Motion, and Interaction behavior to compose concrete retained scenes.
- Tile Motion imports only Game Scene capability and geometry types (`MainSurface`, `ActorPose`); it does not execute scene behavior.
- Tile Interaction imports only Game Scene surface/actor-store types; Game Scene executes its drag and command controllers.
- `game-shell → game-scene` composes the public Board/Inventory surfaces. The reverse `game-scene → game-shell` edge is real UI behavior for the shared Inventory shortcut policy, not a type-only edge. Keep it visible when changing that policy instead of claiming a clean top-level DAG.

The concrete module graph remains acyclic. These edge labels describe why the top-level domains are mutually reachable without pretending every reverse type contract is runtime behavior.

## Flows

- Committed transition: game projection and current presentation claims → reconciler plan → Tile Rendering actor allocation/reconciliation → Tile Motion lanes/choreography → rendering animation channels → demand-frame invalidation.
- Pointer gesture: fresh engine preview → frozen source/target/release facts → one public atomic engine command → reconciliation with the latest committed transition.

Delivery endpoints, generation, phase, and remaining time are engine state. Tick owns countdown and settlement even when no scene or geometry exists; Pixi may retarget, freeze, or hide presentation but never admits input or starts work.

Before delivery takes an existing actor's pose, reconciliation retires its active or pending spawn/input cues through `MotionRuntime.handoffDeliveriesFx`. The real actor keeps its live pose; input-only payloads are destroyed, and released producers/receivers and remaining cue lanes settle normally. Cancelling the pose writer alone does not release cue ownership.

## Interaction

- Board/Toolbar left click runs the primary action; `Ctrl+left click` fills remaining default-line queue capacity; `Shift+left click` splits a Board stack; right click opens Item Detail.
- Inventory left click releases the item; right click opens Item Detail.
- Crossing the drag threshold converts the same pointer gesture into drag. The retained actor is reparented; there is no ghost, screenshot, duplicate tile, or pointer-frequency React render.
- The Engine drop preview owns validity and magnetic eligibility. Pixi geometry never infers merge, stack, storage, swap, or placement behavior.
- Overlays block/cancel local interaction. A submitted engine command may settle canonically after route/gesture teardown. [`useTileCommands`](../tile-interaction/ui/useTileCommands.ts) binds each submission to its exact Game and returns an independent Promise; concurrent callers never share an Atom result.

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
| Scene composition/teardown | `fx/create*RuntimeFx.ts` |
| Actor identity/appearance | `src/tile-presentation` + `src/tile-rendering` + main reconciler |
| Click/drag/drop | `src/tile-interaction` |
| Spawn/swap/stack/replacement cue projection | `src/tile-presentation` |
| Cue execution and playback lifecycle | `src/tile-motion` |
| Autofill delivery | `fx/createDeliveryRuntimeFx.ts`; canonical behavior is `production-delivery/` + Tick |
| Inventory handoff | `ui/PixiInventorySurface.tsx` + main Inventory opener |
| Geometry/hit testing | `fx/create*SurfaceFx.ts`, `fn/read*LayoutFn.ts`, `fn/readSlotFn.ts` |
| Magnetic response | `src/tile-motion` |
| Frame/interpolation | `src/tile-rendering` |

Focused proofs follow the exact owner:

- Semantic projection: `test/tile-presentation`.
- Native actors and animation capabilities: `test/tile-rendering`.
- Playback policy and lifecycle: `test/tile-motion`.
- Gestures and drop execution: `test/tile-interaction`.
- Concrete scene behavior: `test/game-scene/{fn,fx,ui}`.

## Changing this island?

Likely affected:

- Game Shell composition and route-owned teardown.
- Tile actor projection, native rendering, motion, or interaction at the exact changed capability.
- Item Interaction and production commands only when command admission or committed projection changes.
- Focused tests under the changed `test/game-scene`, `test/tile-*`, or Game Shell owner.

Usually not affected:

- Runtime, Tick, persistence, or production decisions for presentation-only work.
- Config authoring, Editor project persistence, Versions, Flow, or Estimate.
- Electron security and IPC unless native window or route lifecycle changes.
