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
| `PixiGameProvider.tsx` | Route-local textures and interaction cancellation |
| `runtime/createPixiApplicationOwnerFx.ts` | One canvas, Pixi application, resize lifecycle, and demand renderer |
| `scene/*Surface*` | Layout, layers, hit geometry, masks, palette, and drop-feedback paint |
| `actor/*ActorStore*` | Retained display-object identity for one canvas |
| `actor/transitionPixiTileActorVisualFx.ts` | One double-buffer lifecycle for complete tile-face revisions |
| `actor/*ParticleTextures*` | One procedural five-point star shared by actor particle containers |
| `animation/createPixiActorAnimatorFx.ts` | Sole writer for root pose and typed presentation channels |
| `scene/createPixiMainSceneReconcilerFx.ts` | Canonical actor reconciliation and presentation entry/exit |
| `motion/createPixiTileMotionRuntimeFx.ts` | Ordered cue lanes, animation claims, transient payloads, and cue settlement |
| `delivery/createPixiDeliveryMotionRuntimeFx.ts` | Canonical delivery travel, retargeting, and generation-guarded contact settlement |
| `drag/*DragController*` | One pointer gesture and its frozen source/release facts |
| `drop/createPixiMainSceneDropPresentationFx.ts` | Accepted-drop presentation facts until canonical settlement |
| `drop/createPixiMainSceneDropSubmissionFx.ts` | Frozen release command, optimistic feedback, and async drop settlement |
| `animation/createPixiAnimationDriverFx.ts` | Motion controls and springs; the only interpolation clock |
| `animation/createPixiActorAnimatorFx.ts` | Interruptible, keyed writes to actor presentation channels |

Main-scene and Inventory actors are intentionally separate: Pixi display objects cannot move
between canvases. Inventory placement starts from the retained main-scene Inventory opener when it
exists. Without that opener, choreography is skipped and ordinary reconciliation presents the
committed transition. The receiving scene still resolves identity and outcome from that transition.

## Data flows

| Flow | Ordered ownership |
| --- | --- |
| Canonical presentation | A committed engine transition enters the scene runtime. The surface receives its exact snapshot, the reconciler projects bridge actors and motion cues, retained presentation mutates, then demand rendering is invalidated. |
| Pointer release | The drag controller asks the bridge for a preview, freezes fresh release-time facts, submits the command, and hands its result plus the current committed transition to drop presentation and reconciliation. |
| Canonical delivery | An engine delivery location projects persisted endpoints, phase, and generation. The delivery runtime adopts the retained actor, animates from its live pose, and submits generation-guarded settlement only at physical contact. The engine then commits input or return placement. |

The renderer may lag, retain, hide, or animate committed facts, but it must not manufacture a
gameplay outcome. Missing visual identities degrade to ordinary reconciliation.

Main-scene reconciliation has one ordered authority boundary. The reconciler first reads committed
bridge projections and the current drop, delivery, and motion claims. A pure local classifier turns
that complete snapshot into ordered actor arrivals and departures. The reconciler then applies the
plan, remaining the only owner that allocates visual generations, mutates the actor store, hands
poses to motion, runs entry or exit effects, and finalizes presentation claims.

## Interaction contract

- Click performs the tile's immediate primary action.
- Right click opens Item Detail.
- Crossing the drag threshold changes the same pointer gesture from activation to drag.
- Press identity stays frozen for drag/drop commands, while click activation reads the latest
  projected actor item. Async activation never owns the next pointer gesture.
- A canonical actor already moving through spawn or swap choreography keeps its click path; crossing
  the threshold explicitly hands its live pose from the motion lane to direct drag.
- Drop validity and magnetic attraction come from bridge previews, never from Pixi geometry or
  renderer-side compatibility rules.
- Main-scene overlays block and cancel local interaction; route teardown closes either scene's
  gesture owner. Submitted engine commands are allowed to settle through their canonical result.

## Lifecycle invariants

- Motion supplies interpolation only. Pixi owns display objects and Effect-owned runtime objects
  own acquisition, cancellation, completion, and teardown.
- The motion runtime keeps scheduling lanes, bounded completed-cue deduplication, detached swap
  handoffs, and live target redirects as separate authorities. One cue-local lifecycle record owns
  only that cue's started phase, revealed input remainder, transient payload actor, and active swap
  legs, so completion and close cannot partially clear parallel bookkeeping.
- Rendering is demand-driven. Every visual mutation invalidates the scene; no idle Pixi ticker or
  second animation loop may run.
- Gameplay feedback animations are intentional product behavior and must not branch on
  `prefers-reduced-motion`; tune their motion directly instead of silently disabling or replacing it.
- Every tile owns one fixed twelve-particle `ParticleContainer` above its face. Main and Inventory
  scenes share one private procedural five-point star texture each; playback only mutates the retained pool,
  widens from one bottom-center apex into an inverted-fire plume, rises through most of the slot
  without crossing its bounds, and uses one linear repeated tween in the existing Motion-driven
  demand renderer. Every star keeps a square aspect ratio while deterministic size and one-, two-, or
  three-cycle rate variants break up the plume without adding another clock. Resolved
  scene luminance directs each retained particle's semantic tint toward white on dark surfaces or
  toward black on light surfaces. Foreground particles use normal compositing so their chroma survives
  both light and dark regions of tile artwork, producing contrast-safe shimmer without allocating
  display objects or restarting playback; appearance refresh updates every retained actor.
- A click ACK owns the shared pool first. If canonical projection starts a job during that burst, its
  final segment interpolates the same particles from ACK pose, alpha, shimmer, and semantic tint into
  the sparse working plume. The infinite running tween adopts that exact final phase without a reset,
  second writer, overlapping emitter, or blank frame.
- Activity-particle bounds match the actor slot. Particle extents, horizontal wave, and the complete
  bottom-anchored plume remain inside that slot while using most of its height. The retained particle
  layer renders in front of the tile face while the progress overlay remains topmost.
- Teardown stops subscriptions and interactions before destroying actors, layers, or the
  application they reference.
- Actor presentation is keyed by physical actor instance and typed channel. `pose`, `grab-offset`,
  `lifecycle-opacity`, `crowd-opacity`, `activity-particles`, and `visual-mix` each have exactly one
  writer; caller ownership keys may cancel work, but may never create a second writer for the same
  channel.
- The animator is the only production writer of root `x`, `y`, `scale`, `pivot`, and `alpha`. Layout
  publishes canonical geometry through surfaces; motion owns normalized progress. Retargetable
  placement samples current geometry without completion snaps. Stack and delivery travel sample a
  receiver's live retained pose; stack payloads hard-snap at physical contact inside a half-tile
  circular field instead of recursively chasing an already adjacent receiver.
- Every texture-bearing visual revision uses one complete private slot. The current slot remains
  renderable until the pending slot has loaded all required textures, then the visual controller
  crossfades both from their live alpha. A superseding revision flattens the surviving composite;
  readiness, cancellation, promotion, and destruction are scoped to the physical visual generation.
- Spawn lifecycle opacity is durable actor intent, independent from travel and from any particular
  texture generation. Travel may start immediately; whichever complete visual survives texture
  supersession resumes the same fade, while a later exit remains free to supersede it.
- Engine-driven spawn, swap, stack, and direct drag share one magnetic field. Spawn and swap repel
  nearby board responders without attracting their own exchange counterpart; a stack payload
  attracts and chases its receiver's live physical pose through distance-aware nonlinear segments.
  Settlement releases the magnetic source. Manual producer input remains committed by its drop
  command; autofill and autonomous input instead create canonical deliveries whose input is not
  available until physical contact settles the matching generation.
- A delivery keeps its exact origin lease until its full quantity commits or returns. Player
  interaction may reduce or invalidate its soft target claim; reconciliation then returns the same
  actor, including any partial remainder, to the persisted origin.
- Delivery travel may retarget from its current live pose when its generation or geometry changes.
  If either endpoint has no geometry, presentation freezes without settlement. Save/hydration keeps
  the delivery phase, generation, origin, and return endpoint, so a later visible main scene resumes
  the physical trip instead of inventing an offscreen gameplay commit.
- Autonomous lines are driven only in the currently presented board space. Switching space or
  unmounting its main scene freezes already admitted physical deliveries; returning to that board
  resumes them from canonical facts. No route-local renderer is allowed to settle invisible cargo.
- Canonical engine items remain the only gameplay truth. Delivery quantity stays canonical on its
  runtime item; ordinary cue motion owns only its narrow, phase-aware presentation overlay. The
  reconciler and animation-triggered refreshes use the same projector, so quantity and badge can
  never disagree.
- Accepted consumption presents exact result/event facts: the surviving source dips, a removed
  source fades, and the receiver emits the shared accent particle burst. Drop-result facts cover manual
  stack, producer-input, and Inventory storage commands that do not emit equivalent engine events.
- Every admitted main-scene tile click immediately emits one optimistic semantic-success particle
  burst before any asynchronous command work. ACK confirms that presentation heard the click; it
  does not claim that the engine will accept the resulting action. If the owner becomes active, the
  same fixed actor-owned pool changes back to its working tint and continues the sparse inverted-fire
  plume without allocating or spawning a competing emitter.
- The main actor store retains physical actors after canonical removal until their exit animation
  completes. Scene teardown destroys every retained exit and cancels visual readiness before its
  parent layers disappear.
- A newly mounted main scene hydrates the current committed snapshot without compiling its
  historical events into choreography. Only later subscription deliveries present motion cues and
  replacements; subscription replay and geometry redraw remain hydration-only.
- Async texture completion is generation-guarded, and route-level texture ownership outlives both
  alternating canvases.

## Where to change behavior

| Change | Start here |
| --- | --- |
| Scene composition or teardown | `scene/createPixi*SceneRuntimeFx.ts` |
| Canonical actor appearance or identity | `actor/` and `scene/createPixiMainSceneReconcilerFx.ts` |
| Drag, left click, right click, or drop release | `drag/` |
| Move, swap, stack, spawn, or replacement choreography | `motion/` and `scene/runPixiMainSceneReplacementsFx.ts` |
| Autofill or autonomous delivery travel and settlement | `delivery/` and bridge `tile/readTileDeliveriesFx.ts` |
| Cross-canvas Inventory release | `PixiInventorySurface.tsx` and the main-scene Inventory opener |
| Hit testing, slot geometry, or masks | `scene/*Surface*`, `layout/`, and `grid/` |
| Magnetic response | `magnet/`; eligibility must continue to come from the bridge |
| Frame scheduling or interpolation | `runtime/` and `animation/` |

Focused regression tests live under `test/ui/pixi`. Update or add an invariant-named test when an
ownership, interruption, settlement, remount, or teardown contract changes.
