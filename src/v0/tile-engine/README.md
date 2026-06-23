# TileEngine public boundary

`src/v0/tile-engine` is package-like generic interaction infrastructure. Code outside
this directory must import from the public barrel only:

```ts
import { TileEngine } from "~/v0/tile-engine";
import type { TileEngineNamespace as TileEngineType } from "~/v0/tile-engine";
```

Do not deep-import files such as `TileEngine.types`, `TileEngineMotionRequestStore` or
`TileEnterMotionSchema` from board, inventory or play code. Dependency Cruiser enforces
this so future quick fixes have somewhere to bounce off, ideally before becoming folklore.

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
- semantic visual event schemas from `src/v0/play`.

Game-specific behavior belongs in adapters. Board and inventory build generic
`TileEngine.Slot` / `TileEngine.Tile` models, `src/v0/play/drop` resolves Arkini drop rules,
and `src/v0/play/game-engine-visual` maps engine domain events directly into generic
TileEngine motion plans. Prefer a stable `TileEngine.Slot.dropId` over ad-hoc
dynamic drop binding ids; the engine uses that id to scope hover feedback before rendering
individual slots, so a drag-over transition only wakes the previous/current targets instead
of politely asking every grid cell to participate in the drama.

## Public exports

The public barrel exports:

- `TileEngine` component;
- the `TileEngineNamespace` namespace type for slots, tiles, drag/drop configs and render props;
- `TileEngineTiming` for adapter cleanup windows that must match engine presence timing;
- motion request types and registry functions used by adapter code.

Everything else in this directory is an implementation detail. Internal hooks and runtime
files may be refactored freely as long as the public barrel contract stays intact.
