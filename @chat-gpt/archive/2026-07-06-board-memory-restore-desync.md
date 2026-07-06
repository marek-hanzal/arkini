# 2026-07-06 — board memory restore desync

- fixed board memory restore routing already-matching saved layout items through inventory during in-place restores
- added fulfillment planning that preserves board items already occupying their saved cell with the expected item id / instance id / quantity
- restore now skips those fulfilled layout indexes and only stores/recreates the items that actually need to move
- fixed board-to-inventory stack-copy placement to transfer the full board stack quantity instead of only one item
- added regression coverage for immediate save/restore staying on board and moved board stack restore keeping full quantity
