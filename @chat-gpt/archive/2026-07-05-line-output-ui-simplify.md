# 2026-07-05 — line output UI simplify

- grouped repeated line outputs by `itemId` into a single rendered row in detail UI
- replaced low-contrast freeform meta text with compact high-contrast output pills
- kept individual runtime output facts (guaranteed / chance / weighted / disabled) as separate pills in one line
- `Owned N` now renders once per grouped resource instead of once per output entry
- added helper test coverage for grouped output row derivation and panel rendering
