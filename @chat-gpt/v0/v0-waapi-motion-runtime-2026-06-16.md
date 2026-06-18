# v0 WAAPI motion runtime migration

Status: DONE
Date: 2026-06-16

## Result

TileEngine motion runtime now uses native Web Animations API through `element.animate()` instead of the external `motion` package. The public TileMotionRuntime contract stayed intact: scoped cancellable motions, current visual freeze on cancellation, completed/cancelled result snapshots, and debug timeline lifecycle events.

`BottomSheet` no longer uses `motion/react`; it is plain React markup driven by CSS transitions on `data-open`. The `motion` dependency was removed from `package.json`.

## Important behavior

Cancel order matters: read/freeze computed style first, then cancel the native animation. Reversing that order brings back teleport/jump bugs because the browser can drop the animated transform immediately.

Completed animations commit the visual state before removing the native animation effect. Tile enter motions still clear visual inline opacity/transform after successful completion, so transient enter styles do not leak into normal feedback styling.
