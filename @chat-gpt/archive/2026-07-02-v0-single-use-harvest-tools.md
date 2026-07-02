# V0 single-use harvest tools

## Completed

- Added transparent 128x128 gameplay assets for `item:axe` and `item:pickaxe`.
- Extended `items.*.removeBy` with optional inline loot output, validated through the normal activation output validation path.
- Wired configured removal tools through drag/drop planning into `tile.remove` actions.
- Runtime now removes the target tile, consumes the tool when configured, rolls removal loot, and places output from the freed target cell.
- `item:pickaxe` mines `item:rock` / Stone Deposit and drops 1-4 `item:stone`.
- `item:axe` harvests tree tiers:
  - `item:tree` -> 1 `item:log`
  - `item:double-tree` -> 1-2 `item:log`
  - `item:micro-forest` -> 1-3 `item:log`
- Blacksmith I can produce `item:pickaxe`.
- Tests cover removal loot placement plus UI interaction planning/action conversion for tile removal.

## Notes

- `removeBy.output` is intentionally generic, not a hardcoded wood/stone hack.
- Removal output uses `tile-remove-output` created events and seeded placement with the removed tile as a freed cell.
