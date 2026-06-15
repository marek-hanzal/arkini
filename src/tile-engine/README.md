# TileEngine

`TileEngine` is the generic tile surface used by the board and inventory.

It owns the UI problems that used to be smeared across board, inventory, drag wrappers, and animation helpers:

- slot drop-target registration
- tile pointer-drag lifecycle
- single/double/long activation timing
- mobile long-press native menu suppression
- stable tile actor rendering
- transient motion staging through an XState registry
- spawn staging for real final actors

It still does **not** own durable game data. Parents provide:

- `slots`: stable positions / drop targets
- `tiles`: stable visual actors with an id and slot id
- `drag`: generic payload builders and lifecycle callbacks
- `renderSlot` / `renderTile`: rendering only

The important rule: a tile is not rendered inside a cell. Slots are geometry. Tiles are stable absolute actors in the engine item layer. When a game action moves a tile, the same actor identity survives and the engine animates from the staged rect into its committed slot.

Board/inventory-specific rules stay outside as data and drop-plan logic. TileEngine only emits generic drag lifecycle events and exposes stable node ids for the existing drag workflow. That gives us one place for tile interaction without infecting the engine with Arkini producer/merge/craft rules, because apparently we are trying not to summon another UI swamp creature.
