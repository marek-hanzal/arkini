# 2026-06-28 - DnD target feedback regression

## Decision

Occupied DnD targets must give feedback on the target actor itself. Valid accepting targets scale/brighten. Refusing targets, including plain swap targets, shrink/dim. Slot-level outline/background chrome is only for empty target cells/slots.

## Fix

- Board plain swap hover now returns blocked feedback instead of no feedback.
- Inventory occupied-slot swap hover now returns blocked feedback instead of empty-slot feedback.
- TileEngine suppresses slot feedback chrome when a target tile exists, so occupied target feedback stays visual-only on the item.
- Actor feedback remains generic and domain-free inside TileEngine.

## Why

The player needs immediate hover feedback on the item under drag. A target item that cannot absorb the source may still be a valid swap destination, but visually it should read as “this item refuses the input,” not as an empty slot accept.
