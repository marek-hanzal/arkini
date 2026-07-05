# 2026-07-05 — pastel light theme

- backed up the pre-theme state by forcing branch `v0` to the previous `main` head before editing
- inverted the core Arkini color tokens from dark purple into a light pastel pink/violet palette
- repainted the main play shell, board frame, board cells, inventory cells, sheets, sheet header, buttons, pills, detail rows, target badges, warnings, and feedback panels for light-theme contrast
- kept tile engine structure untouched; board changes are class/visual-only around the existing TileEngine props and drag/drop model
- updated the board memory shield regression expectation for the new light overlay color
