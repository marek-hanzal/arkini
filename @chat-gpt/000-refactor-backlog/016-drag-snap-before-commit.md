# 016 Drag snap before commit

Status: DONE

## Problem

The previous drag handoff still let the dragged tile visibly jump on move-to-empty and swap. The durable state was already optimistic, but the visible actor still depended on React Query commit/invalidation timing. That is the wrong ownership boundary: TileEngine should own pointer drag and the handoff from released pointer position to target geometry, while query invalidation should be boring data reconciliation.

The broken sequence was effectively:

1. release pointer,
2. start command / optimistic data commit,
3. move the real actor to its committed slot,
4. try to reconstruct the visual motion after React has already moved the chair.

That can still flash as “jump back, then placement”, especially when the same actor is both the live drag actor and the committed tile actor.

## Library analysis

Motion already provides the pieces we need: MotionValues, `animate`, drag controls, and spring/ease primitives. Pulling another gesture library into this would only add another event lifecycle to debug, because apparently one pointer stack was not enough punishment. The fix stays on Motion and keeps TileEngine as the central tile interaction owner.

## Fix

TileEngine now performs a short drop-snap handoff before calling the app-level drop commit:

1. resolve the drop target from the released actor center,
2. animate the dragged actor's own MotionValues into the target slot geometry,
3. pass that snapped rect as the drag commit rect,
4. then let the app run the optimistic command and stage command visual events.

This means board move, board swap, inventory swap, and similar accepted drops no longer need invalidation timing to make the dragged actor appear in the correct target. The command visual event still handles the other affected actor, such as the tile being swapped away.

`usePlayDraggableControl` now stages command visual events after the optimistic mutation and a paint, and only then starts play-data invalidation in the background. Invalidation must not be part of the animation contract.

## Acceptance

- Dragging a board item to an empty cell should not jump back to the original cell before placement.
- Dragging a board item onto a swappable item should not jump the dragged item back before the swap.
- Inventory tile drags should use the same TileEngine handoff path.
- Command visual events should still animate non-dragged affected actors, especially swap targets.
