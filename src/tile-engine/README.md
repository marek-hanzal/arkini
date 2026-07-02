# TileEngine boundary

`src/tile-engine` is package-like generic interaction infrastructure. It intentionally
has no barrel/index file: consumers import the concrete API they use directly so ownership
stays visible and harmless aliases do not grow into fake public surfaces.

```ts
import { TileEngine } from "~/tile-engine/TileEngine";
import type { TileEngine as TileEngineType } from "~/tile-engine/TileEngine.types";
```

Adapter code may also import narrow support APIs such as `TileEngineTiming`,
`TileEngineMotionRequest`, or `TileEngineMotionRequestStore` directly. Internal hooks remain
implementation details; do not reach into them from board, inventory, or play code unless the
module is deliberately promoted into an explicit adapter API. Yes, this is slightly more typing.
Somehow civilization will stagger onward.

## What TileEngine owns

- slot and actor geometry;
- stable slot/drop identifiers used to scope hover feedback to old/new targets;
- pointer lifecycle, tap/double/long activation and drag handoff;
- generic drop hit testing and hover feedback (`empty`, `merge`, `blocked`);
- generic drop outcomes (`accept`, `reject`, `ignore`, `parallel-swap`, `parallel-merge`);
- tile actor transform motion and presence (`enter`/`exit`) playback through WAAPI;
- motion request storage keyed by `engineId` and `tileId`.

## What TileEngine must not know

- Arkini item IDs, board cells, inventory slots, producers, stashes, crafting or economy rules;
- React Query cache shapes;
- domain action names such as `item.spawned`, `item.merged` or `activation.depleted`;
- semantic visual event schemas from `src/play`.

Game-specific behavior belongs in adapters. Board and inventory build generic
`TileEngine.Slot` / `TileEngine.Tile` models, `src/play/drop` resolves Arkini drop rules,
and `src/play/game-engine-visual` maps engine domain events directly into generic
TileEngine motion plans. Prefer a stable `TileEngine.Slot.dropId` over ad-hoc
dynamic drop binding ids; the engine uses that id to scope hover feedback before rendering
individual slots, so a drag-over transition only wakes the previous/current targets instead
of politely asking every grid cell to participate in the drama.
