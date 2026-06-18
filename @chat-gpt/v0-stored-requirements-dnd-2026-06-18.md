# v0 stored requirements DnD checkpoint — 2026-06-18

User direction: do not build special UI flows for filling building requirements. Arkini's core interaction model is drag/drop + merge-like tile interaction. Requirements, filling, moving and placement should be handled through the same tile interaction layer, not bespoke buttons/cards pretending this is a back-office form.

Changes made in this checkpoint:

- `resolveDropIntent` now has an explicit `stored-requirement` intent.
- Occupied board cells accept drops when the target activation requirements can store the dragged item and still have capacity.
- Product-line stored requirements are also considered droppable through `activation.productLines[*].missingRequirementItemIds`, so a requirement that belongs to a non-selected product line still opens the same DnD path.
- Runtime drop dispatch prioritizes missing stored requirements before producer/stash input dispatch. If an item is both a requirement and an input, dragging it onto the building fills the missing durable requirement first. Once the requirement is full, the same drag can feed/start the normal input action.
- Runtime drop dispatch now checks current stored quantity against requirement capacity before choosing `stored_requirement.store`, reducing avoidable engine rejections.
- Removed the stored requirement `Withdraw` button from `ItemActivationInputsCard`; the card is now informational and tells the player to drag matching items onto the tile.
- Product lines now say `Drag requirements in` instead of `Store requirements` when blocked by missing requirements.

Important boundary:

This is only interaction/readiness routing. Persisted save integrity stays centralized in `GameSaveConfigSchema`. Do not duplicate save invariants in UI/drop code. Drop code may decide whether a user gesture should be accepted and which engine action it maps to.

Remaining design gap:

Withdrawal/rearranging stored requirements still needs a tile-interaction answer later. Do not reintroduce a button unless the user explicitly changes the interaction model. A future solution may need a building detail drag source, stored-slot drag handles, or another merge-like interaction that does not become a separate form UI.
