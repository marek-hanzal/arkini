# Craft blocker UI

Craft/blueprint detail now treats effect/start blockers as higher-priority UI than normal resource inputs.

Important invariants:
- When craft has missing grant requirements or active effect blockers, resource input rows are hidden.
- Missing owned-grant requirements should resolve to concrete item blockers when possible, via `grant:owned:<itemId>`.
- The UI should show blocker rows, not a generic `Missing requirements` text box.
- Craft effect requirement view may carry optional `itemId` so blockers can render with the same item-card visual language as inputs.

This exists because a craft could previously say `Missing Required grant` while still showing fillable resources, which is about as useful as a locked door labeled `door`.
