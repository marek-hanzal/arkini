# 2026-07-06 — stack boomerang count timing

- changed partial board stack auto-fill visuals so the live board stack remains visible with its already-decremented runtime quantity
- boomerang transient now represents only the consumed quantity instead of the previous full stack quantity
- removed delayed source-return bounce feedback for partial board stack auto-fill to avoid the impression that count changes after the animation
