# Board stack placement fill-board-first pass

- Fixed inventory stack placement so explicit stack placement fills board stack cells up to item `maxStackSize` and board/maxCount capacity before spilling only the remainder back into inventory.
- Changed exact stack placement to reuse the same seeded board-then-inventory placement pipeline as nearest placement instead of writing the whole stack into a single target cell.
- Updated board placement capacity to count board item units (`emptyCells * maxStackSize`) rather than raw empty cell count.
- Shared stack placement capacity validation between exact and nearest readiness paths.
- Added regression coverage for placing quantity 7 twig stack on a board with two empty cells: board receives 3 + 3, inventory receives 1.

Context: user clarified that board placement should fill the board while there is room and only then fall back to inventory.
