# TileEngine

`TileEngine` is the generic, game-agnostic tile renderer used by Arkini surfaces.

It keeps two concepts separate:

- **slot**: stable geometry/drop target, usually empty and identified by a board or inventory coordinate.
- **tile actor**: stable visual item with its own identity, rendered in one absolute layer above slots.

The engine does not own durable game data. Parent code provides `slots` and `tiles`, and tile actions call parent callbacks (`move`, `swap`, `remove`, `replace`, or custom resolved plans). This avoids the old flyer/grid split: when a tile moves, the same actor stays mounted and only its position changes.

Spawn is exposed through the imperative handle because spawners usually know an external source rect. `spawn({ mode: "instant" })` commits all tile data and stages all final actors at once. `spawn({ mode: "stack" })` commits/stages entries one by one for staggered producer/stash output.

Transient motion state is held by `tileEngineMachine` (XState). No hidden handmade animation registry gets to breed in the walls, because apparently we are trying civilization again.
