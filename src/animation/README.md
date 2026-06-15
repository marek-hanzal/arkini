# Animation

The animation layer is now split between:

- local Motion helpers for feedback pulses and bottom navigation,
- stable board/inventory item actors rendered in their own layers,
- `visualItemMotionMachine`, an XState registry for transient actor origins and priority,
- `stageCommandVisualEvents`, the Arkini adapter that maps command visual events into generic actor motion entries once the caller has the DOM in the right pre- or post-commit shape.

Real game items should not be mirrored through a second overlay representation. Producer, stash, inventory placement, drag moves, swaps, and merge commits all converge on the same rule: the final board/inventory tile is the visual actor, and animation only changes its transform/priority until it settles.


Command visual events stay app-specific and must not leak into `TileEngine`. The mapping boundary lives here: command events know about board, inventory, activation, and item instances; TileEngine only receives generic actor ids, rects, priorities, and transition kinds. Yes, this extra seam looks boring. Boring seams are how we avoid creating another cursed renderer with a production job title.
