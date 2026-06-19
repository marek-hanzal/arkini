# v0 DnD interaction contract hardening - 2026-06-18

Checkpoint commit: pending at the time of writing.

Context:

- Stored requirements must be filled through the core drag/drop + merge-like tile interaction model.
- Do not add special Store buttons or bespoke requirement UI. Requirement filling is a drop interaction onto the building/target tile.
- Drop routing must stay deterministic because `resolveDropIntent` is now the shared interaction contract for board hover feedback and board/inventory drop acceptance.

Decisions made:

- Missing stored requirements are now treated as merge-like hover feedback (`effect: "merge"`) so requirement targets do not look blocked while they are actually droppable.
- Drop intent priority is now: reverse-directed merge reject -> regular merge -> missing stored requirement -> craft input -> activation/producer/stash input -> swap.
- Runtime action dispatch mirrors the same durable-before-consumable policy after regular merge: stored requirement fill happens before craft/product/stash consumable input actions.
- Product-line `missingRequirementItemIds` remains a readiness hint that opens the DnD requirement path. Disabled product lines do not expose missing requirements as droppable targets.

Test coverage added:

- Dedicated `resolveDropIntent` tests cover merge priority, stored requirement vs consumable input priority, full requirement fallthrough, product-line requirement routing, disabled product-line ignore behavior, and stored requirement before craft input.
- Board drop feedback test covers stored requirement targets as merge-like feedback.

Keep in mind:

- This pass deliberately does not add new TileEngine feedback effects like `requirement`. Visual polish can come later, but the contract now exposes stored requirements as an accepted merge-like interaction.
- Avoid duplicating stored requirement eligibility elsewhere. UI/readiness can hint, but action legality and save integrity remain engine/schema owned.
