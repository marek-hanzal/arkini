# Animation

The DOM animation layer is intentionally tiny now:

- Motion may animate app chrome such as bottom-navigation pulses and sheets,
- Phaser owns board/inventory item movement, merge feedback, ready glow, progress bars, and slot/cell highlights,
- game items must not be mirrored through a DOM overlay just to fake motion across React commits.

Real game items should remain real Phaser actors inside their local scene. If a board or inventory animation needs item geometry, solve it in the relevant scene instead of resurrecting the old DOM-rect ritual. The ritual looked clever; it was mostly a bug farm wearing a tie.
