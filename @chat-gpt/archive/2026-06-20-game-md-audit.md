# GAME.MD audit against current runtime

Audited GAME.MD against the current game action schema, producer/stash/craft/runtime interaction flow, drop resolvers, and config schema.

Updates made:

- Replaced stale board double-click storage notes with current item-detail Store behavior.
- Documented empty-board-cell long press inventory placement target.
- Clarified inventory-to-board drag/drop can place, merge, fill stored requirements, feed craft/producer, or open keyed stash, while inventory-to-inventory drag only swaps slots.
- Rewrote producer section around product jobs, queue size, default/enabled product lines, auto-fill, proximity duration factor, blocked delivery retry, and sink products.
- Rewrote stash section around whole-stash open, open-time consumable inputs, stored requirements, and all-or-nothing placement.
- Corrected craft timer behavior: deposited inputs make craft ready, explicit start begins/finishes the timer.
- Added tile removal/removeBy notes.
- Updated data model expectations, open questions, implementation conformance notes, and testing checklist.

Remaining intentional boundaries:

- GAME.MD is the canonical gameplay spec; README may still contain older broad project wording and is not treated as source of truth here.
- Tile removal is engine-supported but not a generic drag/drop fallback UI.
- Stored requirement withdrawal exists engine-side; current item detail UI does not expose a full stored-requirement withdrawal surface yet.
