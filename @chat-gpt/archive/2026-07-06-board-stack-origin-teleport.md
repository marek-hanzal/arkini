# 2026-07-06 — board stack origin teleport

- fixed board-to-board stack merge visual replaying a transient fly from the source origin
- board stack actions now only trigger immediate target bounce feedback; the live drag already provides the movement to target
- producer/output stacking still keeps the transient fly into an existing board stack, because there is no user-dragged source actor for that path
