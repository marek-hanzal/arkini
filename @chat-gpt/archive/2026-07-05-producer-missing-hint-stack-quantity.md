# Producer missing-resource hints respect board stack quantity

## Context
- User reported that clicking a producer/auto-fill target bounced the resource producer (e.g. Quarry) even when the board already had a large enough stack of the required input item.
- Example: Stonemason input wants stone, board has a stone stack with quantity 6, but Quarry still flashes as a missing-resource hint.

## Fix
- `readProducerMissingResourceHintTileIds` previously counted matching board item instances with `.length`, so a stack of 6 counted as only 1 available item.
- Replaced that count with a sum of `readBoardViewItemQuantity(boardItem)`, preserving the existing exclusion of the target producer item itself.
- `registerProducerMissingResourceHints` now passes the activated `lineId` through to `readProducerMissingResourceHintTileIds`, so hints evaluate the actual clicked line instead of accidentally falling back to the default line.

## Tests
- Added regression coverage for a board stack whose quantity fully covers the missing input requirement while a source producer exists for the same item.
- Expected result: no source producer hint bounce.
