# v0 animation sequence render fix

Status: DONE

## Goal

Fix the follow-up report where producer/stash output sequencing improved, but the visual enter animation still looked instant, and keep merge/presence motion from fighting generic layout/drag transforms.

## Findings

The sequence scheduler already delayed each spawn cache patch by `animation.delayMs`, but the delayed event still reached TileEngine with the same `delayMs`. That meant a spawned actor could be inserted into the DOM at full opacity and only then ask Motion to wait again before running its fade/travel. Very charming, if the desired UX is “teleport first, animate theoretically later”.

Presence enter/exit motion also ran on the outer actor element, the same element used for drag/snap/layout transforms. That is fragile because transform ownership gets shared by unrelated systems.

## Changes

- Sequence scheduler now clears render delay when applying an already-scheduled sequence event. The stagger remains in the scheduler, and TileEngine starts the visual enter immediately when the item is inserted.
- `TileEnterMotionSchema` keeps `sequenceIndex` so repeated sequence pulses on the same mounted inventory stack are distinguishable even after render delay is normalized to zero.
- Existing inventory stacks now receive enter motion when activation output increments them, not only when a new stack is created.
- TileEngine presence enter/exit now animates the inner `.ak-tile-engine-visual` element instead of the outer positioned actor. Generic layout/drag/snap transforms stay on the actor.
- Presence enter clears its inline final opacity/transform after completion so CSS hover/drop feedback can keep working.
- Actor cleanup now cancels active motions on the actor and descendants, because presence motions moved to the inner visual element.

## Validation

- `npm run format:check`
- `npm run typecheck`
- `npm run test`
- `npm run dc`
- `npm run check`
- `npm run build`
- `git diff --check`
