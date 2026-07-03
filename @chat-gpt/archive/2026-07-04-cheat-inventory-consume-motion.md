# Cheat inventory consume motion

Fixed the long-standing cheat inventory DnD jump: board items dropped onto `item:cheat` now resolve to a TileEngine `consume` drop animation. The source snaps to the cheat tile, fades/scales out in place, commits the debug delete, and avoids the normal post-commit transform reset/handoff path that made the actor jump back to its origin.

`debug-delete` `item.removed` events are ignored by the board-origin retained-tile visual planner because the DnD source actor owns that visual removal. Other removed board items still retain the board-origin remove animation.

Covered by drop action/animation contract tests and visual plan regression coverage.
