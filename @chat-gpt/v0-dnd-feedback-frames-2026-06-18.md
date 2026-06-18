# V0 DnD feedback frames, 2026-06-18

Intent: keep DnD feedback visual and generic without adding labels, badges or special UI.

Decision:

- TileEngine keeps only generic `DropFeedbackVariant` values: `subtle`, `primary`, `secondary`, `danger`.
- Arkini maps domain meaning outside TileEngine:
  - stored requirement hover/success => `primary` (blue frame)
  - craft / producer / stash consumable input hover/success => `secondary` (green frame)
  - regular merge => no extra frame, because the tile merge animation already carries the interaction
- Do not teach TileEngine words like requirement, producer, resource or Arkini-specific behavior.
- Keep frames subtle. Avoid labels/tooltips/extra text. This is tactile feedback, not a small CRM form taped to a tile.

Implementation notes:

- `resolveBoardDropFeedback` returns semantic generic variants for hover feedback.
- Board and inventory-to-board successful drops pulse board cells through `Feedback.pulseBoardCellFeedback` using the same generic variants.
- Existing aggressive red/green borders were toned down in CSS while preserving current motion/scale feedback.
