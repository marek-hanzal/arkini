# Board padding + DnD boundary follow-up

Status: completed 2026-07-03

- Board surface now has viewport padding so the board no longer starts/ends on the window edges.
- Board visual chrome stays on the TileEngine root without extra root padding; the earlier `p-2` frame was removed from the board engine geometry.
- Responsive container sizing moved to an inner board viewport so the visual padding is outside the board math.
- TileEngine now uses its own grid element as the default drag constraint, keeping drag clamping aligned with the actor/drop grid instead of an outer decorated root. Callers can still pass an explicit `dragConstraintsRef` when they deliberately need another boundary.
- Board grid/cells got higher-contrast purple gradients and stronger inset lines while keeping the palette subtle enough not to fight tile art.
