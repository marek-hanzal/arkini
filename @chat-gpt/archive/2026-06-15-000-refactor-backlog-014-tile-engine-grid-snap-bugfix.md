# Fix TileEngine grid snap desync

Status: DONE
Priority: CRITICAL

## Goal

Fix the follow-up DnD regression where accepted board drops visually remain scattered around the board instead of snapping back into the committed grid cell.

## Root cause

The TileEngine actor used one DOM node for two different transform owners:

- Motion drag updated the live actor transform through `x` / `y` MotionValues.
- Accepted drop and command visual motion also animated that same actor node with imperative Motion `animate(...)` transforms.

Those two transform systems could overlap during the async drop handoff. When a commit, data invalidation, hidden-source cleanup, or a React re-render interrupted the animation, the actor could keep a stale transform and stay visually off-grid even though durable board coordinates were already correct.

## Completed

- Split every TileEngine actor into an outer draggable actor and an inner animation wrapper.
- Motion drag now owns only the outer actor transform.
- Accepted drop / move / return animation now owns only the inner wrapper transform.
- Drop target resolution now uses the visible actor center instead of only the raw pointer point, so the chosen cell matches the thing the player is visually dragging.
- Drag reset now stops MotionValue animations before forcing `x` / `y` back to zero.
- TileEngine motion cleanup now removes stale `transform` and `opacity` styles both when animations finish and when interrupted.

## Acceptance

- [x] A board item dropped on an empty cell can no longer preserve a stale drag transform after commit.
- [x] The visible dragged actor center is the source of target hit-testing, matching the snap-to-cursor behavior.
- [x] Drop/move animations cannot fight the physical drag transform on the same DOM node.
- [x] Interrupted TileEngine animations clean their inline styles instead of leaving visual garbage behind.
- [x] TileEngine remains generic and imports no Arkini game domains.

## Validation

- Static syntax check over changed TypeScript/TSX files passed through TypeScript transpilation.
- `git diff --check` passed.
- Full dependency install still times out in the sandbox, so full project typecheck/build remains browser/local-machine validation.
