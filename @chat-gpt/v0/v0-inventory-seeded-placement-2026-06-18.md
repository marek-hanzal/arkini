# v0 inventory seeded placement

Status: completed
Date: 2026-06-18
Commit: TBD

## Decision

Long-pressing an empty board cell opens inventory in placement mode with that cell as the placement seed.

Double-tapping an inventory stack in that mode dispatches `inventory.item.place` with `placementMode: "nearest_by_manhattan"`, the selected seed cell and the whole current stack quantity. The engine consumes the stack and reuses the shared board-then-inventory placement planner, so the first item tries the seed cell and any additional quantity is placed by Manhattan distance around that seed, with inventory fallback matching producer output semantics.

Normal inventory double-tap placement remains exact single-item placement against the first empty board cell. In seeded placement mode, double-tap placement stays available repeatedly and the inventory sheet remains open after each successful placement. Drag-and-drop inventory placement remains exact for its explicit target cell.

## Architecture notes

- TileEngine remains generic. Slot drop bindings now support optional `onLongActivate`, but they do not know anything about Arkini inventory placement.
- Board adapter wires empty board-cell long press to opening inventory placement mode.
- Inventory UI only changes double-tap behavior in placement mode: double-tap places the selected stack around the seed and keeps the sheet open. Single tap does nothing useful here and must not trigger placement.
- Engine placement is controlled by `GameActionInventoryItemPlaceSchema.placementMode`:
  - `exact`: existing single-item exact target behavior.
  - `nearest_by_manhattan`: seeded board-then-inventory placement using the shared planner.

## Guardrails

Do not add a second local search for inventory placement. Producer output, stash/craft output and inventory seeded placement should keep sharing the same planner semantics.
