# 2026-07-02 Output-owned producer effects

User clarified that passive item effects were correct on root item definitions. The actual issue was root-level `products.*.effects` on producer/stash product definitions.

Implemented current contract:

- `products.*.effects` is removed from authoring and compiled schemas.
- Producer/stash-facing effect rules live only on concrete `output` entries, including weighted output entries.
- Output-owned producer effects cover visibility/start gates, blockers, duration modifiers, hide/show, enable/disable, grant bonus chance, and nearby output chance.
- Runtime computes product-line visibility/readiness/duration/loot from output-owned effects. Sibling outputs no longer inherit root product rules by accident.
- Craft recipes keep their own limited effect model: start `grant.require` and `grant.blockStart` only.
- Passive item `passiveEffectIds` remain root item facts and were not changed.

Important migration detail: old product root effects were pushed down into affected outputs. Duration effects were attached once per product output plan so multi-output lines do not multiply duration per sibling drop.
