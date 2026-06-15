# Animation

The animation layer is now split between:

- local Motion helpers for feedback pulses and bottom navigation,
- stable board/inventory item actors rendered in their own layers,
- `visualItemMotionMachine`, an XState registry for transient actor origins and priority.

Real game items should not be mirrored through a second overlay representation. Producer, stash, inventory placement, drag moves, swaps, and merge commits all converge on the same rule: the final board/inventory tile is the visual actor, and animation only changes its transform/priority until it settles.
