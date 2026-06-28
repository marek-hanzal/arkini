# UI/backend cross bughunt follow-up

Context: second cross-pass after UI live view source cleanup, focused on duplicate truth, stale UI reads, explicit producer default semantics, and stash/producer shared product-line plumbing.

Decisions and fixes:

- Producer default product line is explicit player state only. No implicit first-line fallback. The root README now states this hard rule and the old 2026-06-19 default-line archive note is marked superseded.
- Board drop feedback now checks live source existence before showing empty/merge feedback. Inventory-only items dragged onto an empty board cell show blocked feedback, matching backend storage policy instead of lying like a tiny green UI gremlin.
- Stash input interactions win before generic producer input routing. Stashes reuse producer product-line view plumbing for display/progress, but input drops must still dispatch `stash.open`, not `producer.input.store`.
- Board item tap activation re-reads the live runtime snapshot before deciding craft claim/start, producer activation, stash open, and missing-resource hint feedback.
- Inventory slot drop feedback and actual inventory-slot/cell drops re-read live inventory state and reject stale or item-mismatched source slots instead of showing/committing a valid swap/drop for an item that is already gone or replaced.
- Inventory double-tap placement re-reads live inventory and live first-empty board cell before dispatching placement.

Regression coverage added around inventory-only board feedback, stale inventory source feedback, stash input routing, and stash drop feedback.
