# Multi-space query and ownership closeout

Status: Done

The multi-space review was resolved with the following accepted product semantics:

- `currentSpace` is presentation plus ordinary inventory-drop destination, not a global authorization boundary;
- direct board-to-board cross-space operations and cross-space production remain forbidden;
- inventory is the only bridge, so an explicit inventory source may interact with an off-screen board target;
- storage scope is `board | inventory | any`;
- query scope is `board | inventory | any | universe`;
- `any` means origin-space board plus shared inventory;
- `universe` means every board space plus shared inventory;
- all current Arkini progression-existence queries were classified as universe-wide and migrated;
- attached jobs, inputs, reservations, and queue state have no historical space and travel with their owner through inventory;
- local dependencies are re-evaluated after travel and may pause work; universe dependencies remain visible;
- exported plain selector, eligibility, location-equality, and input-filter helpers were removed in favor of coarse Effect operations with private local predicates;
- malformed scalar hardening was deliberately rejected because trusted schema boundaries own primitive validity.
