# 2026-07-06 — cracked rock search renewal

- added `item:magnifying-glass` as reusable search/survey tool with 128x128 transparent PNG asset
- converted `item:cracked-rock` into a craft target that accepts the magnifying glass without consuming it
- added craft `resultPlacement: "random-board"` runtime support: target craft item is removed and result item is spawned on a random board cell
- updated craft input storage/autofill so `consume: false` inputs are recorded as delivered without removing the source item
- updated limited-deposit audit to ignore non-consumed craft tools as renewal dependencies
- verified capacity depletion replacement still keeps the replacement item on the original board cell through existing regression coverage
