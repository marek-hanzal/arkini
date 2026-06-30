# 015 Drag commit handoff

Status: OBSOLETE - superseded by `016-drag-snap-before-commit.md`.

## Problem

Board move-to-empty and board swap could still show a visible jump in the dragged actor. The command state was correct, but the animation handoff was staged before React Query invalidation rendered the actor in its committed slot.

That meant the same stable tile actor started its transient Motion animation while its outer `TileEngine` placement still pointed at the old slot. Query invalidation then moved the outer actor to the new slot while the inner animation was already in flight, producing the classic frontend magic trick: jump back, then appear in the correct place, because apparently one transform stack was not enough suffering.

## Fix

Drag-drop command commits now run in this order:

1. mutate command,
2. invalidate affected play data,
3. wait for paint so committed board/inventory DOM is present,
4. stage command visual events from the drag rect into the final actor slot.

This keeps `TileEngine`'s outer actor placement aligned with durable game state before the inner visual-motion wrapper starts animating. Empty-cell move and swap therefore animate from the dropped rect into the final slot instead of briefly using the old slot as the animation base.

## Notes

Non-drag command helpers still own their own staging order because they may need pre-commit DOM for producer/stash/activation-style events. This task only changes the drag-drop path in `usePlayDraggableControl`.

## Superseded note

This sequencing still tied the handoff too much to query invalidation. The corrected approach is documented in `016-drag-snap-before-commit.md`: TileEngine snaps the live dragged actor into target geometry before the app commit, then command visual events use that snapped rect while invalidation runs only as background reconciliation.
