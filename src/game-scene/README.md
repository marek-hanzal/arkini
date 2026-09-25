# Game Scene

Game Scene owns the visible Pixi Board. The Engine publishes canonical Runtime and ordered events;
scene code projects them, never decides gameplay. [ARCHITECTURE.md](../../ARCHITECTURE.md)
defines that direction.

## Owners

| Concern | Public owner |
| --- | --- |
| Acquisition, teardown, transition subscription | [createMainRuntimeFx.ts](fx/createMainRuntimeFx.ts) |
| Board geometry, layers, mask and canonical hit testing | [createMainSurfaceFx.ts](fx/createMainSurfaceFx.ts) |
| Current-space actor identity and visual reconciliation | [createMainReconcilerFx.ts](fx/createMainReconcilerFx.ts) |
| Space and Template exit, render barrier and arrival | [createBoardTransitionPresenterFx.ts](fx/createBoardTransitionPresenterFx.ts) |
| Replaceable item and Board feedback requests | [createPresentationRuntimeFx.ts](fx/createPresentationRuntimeFx.ts) |
| Camera fit, pan, zoom and edge navigation | [createBoardCameraFx.ts](fx/createBoardCameraFx.ts) |
| Semantic visible actors | [readTileActorsFx.ts](../tile-presentation/fx/readTileActorsFx.ts) |
| Native actors, texture readiness, interpolation | [createTileActorFx.ts](../tile-rendering/fx/createTileActorFx.ts), [createAnimationDriverFx.ts](../tile-rendering/fx/createAnimationDriverFx.ts) |
| Pointer gestures, preview and drop submission | [createMainDragControllerFx.ts](../tile-interaction/fx/createMainDragControllerFx.ts), [createDropSubmissionFx.ts](../tile-interaction/fx/createDropSubmissionFx.ts) |

## Flow

- An ordinary commit updates canonical actor identities and presentation requests. The reconciler
  requests pop on arrival, fade and shrink on departure, crossfade for different identities in one
  slot, or travel toward a live target. Artwork replacement waits for a complete texture and then
  crossfades through the same presentation owner, including merges that keep their runtime ID.
  A newer replacement continues from the visible blend. Progress and Clock rings follow the current snapshot.
- Committed `item:spawned` and `item:placed` facts give new Board items a visible origin. They pop
  while moving away from that origin, fly to their live destination, then settle. A true same-slot
  replacement crossfades. Newly admitted outbound deliveries pull their existing Board actor toward
  the live input owner, using the exact previous and final Runtime identities; missing visuals simply
  use the final snapshot.
- Space and Template use the same sequential transition. The visible Board and its items exit
  together. Until it vanishes, later commits may update that visible Space. After a render barrier,
  the latest snapshot replaces its geometry and actors, the camera fits the new Board immediately,
  and the Board fades in with staggered item arrivals. Only one Board is mounted at a time.
- Tick and jobs continue in the Engine while a Board is hidden. Their completed results are
  projected from the latest snapshot when shown; hidden feedback is not replayed. A new Space
  requested during a transition is coalesced to the latest destination.
- Interaction is blocked until the Board has settled. Pointer drag, target preview, camera
  gestures and exact drop commands retain their own owners and remain available during ordinary
  item feedback. A pending drop is keyed by its exact generation; late results cannot claim a
  different actor. A travel request blocks grabbing its actor even while artwork is loading.
  Dragged items keep their live pose through canonical updates.

## Interaction and lifetime

The Board uses fixed 512 px world cells. The camera supports wheel and pinch zoom anchored at the
pointer, right drag pan, edge pan while dragging,
`0` to fit, and resize that preserves the viewed center. Engine preview owns drop validity;
Pixi hit testing supplies coordinates and the exact canonical target. Hover feedback never changes
hit geometry or admission. Hover grows only the tile art, shows a small detail control with a
larger hit area, and yields smoothly to drag, blocked interaction and canonical travel. Pointer-anchored
zoom preserves both hover and an active item drag.

A short left click admits the effective Default line, then opens Item Detail. Ctrl+left click
fills its queue, then opens Detail. A short right click opens Detail without a production command;
right drag remains camera pan. Queue playback owns Autofill and job start after admission.

The scene owns one actor per visible runtime identity. A transported identity receives a fresh
Pixi actor in its destination Space. Animation requests can be replaced or cancelled without
changing Engine truth. A lifecycle replacement continues from the current frame; cancelling an
arrival restores a complete visible face for the next owner. Async texture generations and scene teardown prevent late callbacks from
publishing into destroyed actors. The animation driver invalidates demand frames; Pixi has no
second animation clock.

## Changing this island

Likely affected: Game Shell mount/teardown, Tile Presentation actor values, Tile Rendering
visuals/animation channels, Tile Interaction gestures, and focused `test/game-scene` or
`test/tile-*` behavior.

Usually not affected: Engine Tick, production outcomes, project persistence, Editor authoring,
Graph queries and Electron IPC. Follow an Engine owner only if canonical Runtime or command
semantics change.
