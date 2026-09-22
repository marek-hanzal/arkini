# Game Scene map

Game Scene is Serakki's concrete retained Pixi executor. `src/tile-presentation` owns semantic actor projections, `src/tile-rendering` owns native actors and animation capabilities, `src/tile-motion` owns deterministic playback, and `src/tile-interaction` owns pointer gestures plus activation and drop execution.

The engine remains gameplay truth. React owns routes, pages and menus; `src/item-detail` owns Item Detail dialog composition. Start at `fx/createMainRuntimeFx.ts` for Board.

The root has only direct grammar layers: `ui/` for React canvas composition, `fx/` for lifecycle and retained mutation, `fn/` for shared explicit-input calculations, `service/` for readonly scene capabilities, and `type/` for cross-owner geometry values. No layer contains semantic filing subdirectories.

## Owners

| Area | Owner |
| --- | --- |
| Board camera, zoom and pan | `fx/createBoardCameraFx.ts` |
| Routed canvas acquisition, overlay blocking and teardown | `ui/useBoardRuntime.ts` |
| Canvas, resize, demand rendering | `src/tile-rendering/fx/createApplicationOwnerFx.ts` |
| Semantic actors, feedback, replacements, motion intents | `src/tile-presentation/{type,fn,fx}` |
| Native actors, visuals, readiness and particles | `src/tile-rendering/{type,service,fn,fx}` |
| Surface geometry, layers, masks, feedback | `fx/create*SurfaceFx.ts`, `fx/draw*Fx.ts`, and `fn/read*LayoutFn.ts` |
| Main retained identity | `src/tile-rendering/service/MainActorStore.ts` |
| Canonical reconciliation | `fx/createMainReconcilerFx.ts` |
| Pointer gestures, activation and frozen release facts | `src/tile-interaction/{atom,fn,fx,type}` |
| Drop submission/presentation | `src/tile-interaction/fx/createDrop*Fx.ts` |
| Engine-delivery presentation | `fx/readTileDeliveriesFx.ts` + `fx/createDeliveryRuntimeFx.ts` |
| Cue lanes, choreography and handoffs | `src/tile-motion/{service,type,fn,fx}` |
| Interpolation/springs | `src/tile-rendering/fx/createAnimationDriverFx.ts` |
| Typed actor-channel writes | `src/tile-rendering/fx/createActorAnimatorFx.ts` |

## Dependency shape

- Game Scene executes Tile Presentation, Rendering, Motion, and Interaction behavior to compose concrete retained scenes.
- Tile Motion imports only Game Scene capability and geometry types (`MainSurface`, `ActorPose`); it does not execute scene behavior.
- Tile Interaction imports only Game Scene surface/actor-store types; Game Scene executes its drag and command controllers.
- `game-shell → game-scene` composes the public Board surface.

The concrete module graph remains acyclic. These edge labels describe why the top-level domains are mutually reachable without pretending every reverse type contract is runtime behavior.

## Flows

- Committed transition: game projection and current presentation claims → reconciler plan → Tile Rendering actor allocation/reconciliation → Tile Motion lanes/choreography → rendering animation channels → demand-frame invalidation.
- Pointer gesture: fresh engine preview → frozen source/target/release facts → one public atomic engine command → reconciliation with the latest committed transition.

Delivery endpoints, generation, phase, and remaining time are engine state. Tick owns countdown and settlement even when no scene or geometry exists; Pixi may retarget, freeze, or hide presentation but never admits input or starts work.

Before delivery takes an existing actor's pose, reconciliation retires its active or pending spawn/input/swap cues through `MotionRuntime.handoffDeliveriesFx`. The real actor keeps its live pose; released producers/receivers and remaining cue lanes settle normally. A superseded swap releases both writers and settles its other grid actor from the live pose. Cancelling the pose writer alone does not release cue ownership.

Input contact retires the delivered item actor. The source and receiver remain claimed until consumption feedback finishes.

A delivery reappearing during its exit replaces the old exit ownership before cancellation. Canonical settlement restores any unfinished exit; obsolete completion callbacks cannot remove or hide the surviving actor.

Moving items cannot be clicked or dragged until they land. Pointer admission and release both check current motion ownership and pose animation, so an item that starts moving after pointer-down cannot be activated from stale gesture state. Once the last cue releases an actor, any remaining positional correction targets its latest canonical location without interrupting another pose owner.

## Interaction

- Board uses fixed 512 px world cells under the same camera implementation, with one camera per canvas, including masks, feedback and transient actors. The initial camera fits the whole scene; wheel/pinch zoom anchors at the pointer and right drag pans freely. Left drag starting on an empty Board cell also pans; admission uses canonical slot occupancy at pointer-down, while item drags keep their existing ownership. A short right click still runs its tile action; crossing the screen-space drag threshold gives the gesture to the camera. `0` restores the fitted default view for the mounted Board in both Game and Editor. Resize preserves the viewed world center and zoom. Pointer coordinates enter world space before tile gestures; the drag threshold stays in screen pixels. Camera gestures cancel tile gestures, and overlays block both.
- When the complete canvas scene exceeds its viewport on an axis, hovering near that viewport edge pans the shared camera, bounded to one scaled world cell beyond the scene. The Board activates edge navigation. Left-button item dragging keeps edge navigation active and refreshes the held actor and drop target after camera movement. Right-button camera gestures, overlays, pointer exit, blur, resize and teardown stop it; demand frames run only while the camera moves.
- Board right click runs the primary action; `Ctrl+right click` fills remaining default-line queue capacity; left click opens Item Detail. Portals retain left-click activation and right-click Detail. Item dragging remains on the left button and camera dragging on the right.
- Crossing the drag threshold converts the same pointer gesture into drag. The retained actor is reparented without allocating a second gameplay actor or triggering pointer-frequency React renders. A non-interactive snapshot marks its committed origin below the actor layer until the real actor settles or leaves the scene; it never participates in hit testing or drop preview. Travel settles into the single Board actor layer. Canonical slot occupancy selects pointer hits and drop targets.
- During manual drag, the hovered target artwork shrinks and fades to 0.8 for rejected drops or swaps, then returns on target change or gesture end. Merge and input acceptance keep their normal appearance. This response has its own animation channel and never changes placement, hit geometry, lifecycle or running opacity.
- The Engine drop preview owns validity. Pixi geometry never infers merge, input, swap, or placement behavior.
- Overlays block/cancel local interaction. A submitted engine command may settle canonically after route/gesture teardown. [`useTileCommands`](../tile-interaction/ui/useTileCommands.ts) binds each submission to its exact Game and returns an independent Promise; concurrent callers never share an Atom result.

## Invariants

- One reconciler owns actor allocation, visual generations, store mutation, and presentation-claim settlement.
- One animator owns each typed presentation channel; ownership keys may cancel work but cannot create a competing writer. Motion is the only interpolation clock, and the Pixi ticker is not a second loop.
- Root pose, grab offset, lifecycle, crowd, particles, and visual revision remain independent channels. Tuning belongs in implementation, not this contract.
- `TileActorVisual.artworkScale` projects the required authored `artwork.scale` once. Retained faces, layers, badges, progress and activity geometry use it on Board, including Editor Board. Every crossfade slot keeps its own revision's ratio. The slot anchor, hit area and placement geometry remain full-size; transient actor/container motion still settles to its own neutral scale.
- Actor stores follow exact runtime identities within their canvas. Placement and return preserve existing identities; presentation reconciles committed runtime state rather than inferring continuity from intent.
- Birth scale is allowed only over visually empty artwork space. Main arrivals and produced items inspect rendered artwork at their birth pose, including exiting and transient actors; occupied births fade in at full size and freeze any overlapping outgoing scale. Canonical occupancy alone cannot choose this feedback.
- A removed output producer starts its exit with output dispatch, including output into its own slot; output travel and artwork readiness never delay that exit. Its retained actor supplies origin geometry until queued outputs release their claims.
- Hydration presents the current snapshot without replaying historical events. Only later event batches drive choreography.
- Board Clock rings project the canonical interval phase and Clock enable/rules independently of jobs and queue admission. They have no pointer interaction; the existing job/lifetime bar retains its precedence. Exhausted finite Clocks have no upcoming pulse ring.
- Async texture completion is generation-guarded. A complete current visual remains until a complete replacement is ready; superseded work cannot publish or destroy the surviving generation.
- Every physical visual generation owns reference-counted texture leases. Active visuals pin their shared textures; released textures enter the route-local decoded-byte LRU, and the texture store evicts idle entries without unloading a texture behind another visual. Backing texture ownership and per-URL unload ordering are shared across route stores to match the global Pixi Assets cache, so an old provider cannot destroy a reopened Board's textures.
- Teardown cancels gestures, subscriptions, animation, and async readiness before destroying actors, layers, textures, or the application.

## Navigation

| Change | Start at |
| --- | --- |
| Scene composition/teardown | `fx/create*RuntimeFx.ts` |
| Actor identity/appearance | `src/tile-presentation` + `src/tile-rendering` + main reconciler |
| Click/drag/drop | `src/tile-interaction` |
| Spawn/swap/replacement cue projection | `src/tile-presentation` |
| Cue execution and playback lifecycle | `src/tile-motion` |
| Autofill delivery | `fx/createDeliveryRuntimeFx.ts`; canonical behavior is `production-delivery/` + Tick |
| Geometry/hit testing | `fx/create*SurfaceFx.ts`, `fn/read*LayoutFn.ts`, `fn/readSlotFn.ts` |
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
