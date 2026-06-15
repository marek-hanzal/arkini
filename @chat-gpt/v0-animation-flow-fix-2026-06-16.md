# v0 animation flow fix

Status: DONE

## Goal

Fix the first post-reactive-tile animation regressions without reintroducing central state piles: swap must animate both sides together, spawned items must visually enter instead of appearing as cache teleports, stash exhaust output should stage item-by-item, and tile actors must not render above bottom sheets/backdrops.

## Library check

Arkini already uses Motion, so the fix keeps animation execution in the existing Motion runtime. React Query remains the durable state/cache owner. No extra gesture or animation dependency was added; the changes are TileEngine-specific and game visual-event-specific.

## Changes

- Extended `TileEngine.DropOutcome` with an explicit `DropAnimation` hint.
- Marked board swaps and inventory slot swaps as `parallel-swap` accept outcomes.
- Changed TileEngine handoff storage from a single pending handoff to keyed multi-handoffs so source and target actors can both consume stable post-commit resets.
- Added reciprocal target actor animation for parallel swaps before committing the cache patch.
- Added transient `ViewMotionSchema`/`EnterMotionSchema` to board/inventory cache views.
- Added TileEngine enter motion for freshly spawned tiles only when the tile carries `enter` metadata.
- Added visual-event staging for stash exhaust: non-spawn facts apply immediately, spawned items apply one-by-one with a short delay. Producer/single activation output still applies as one batch.
- Raised bottom sheet/backdrop/nav/toast stacking so tile actors no longer leak above modal UI.

## Validation

- `npm run format:check`
- `npm run typecheck`
- `npm run build`
- `git diff --check`
- forbidden grep pass for `useQuery(`, `getQueryData`, `switch (`, custom contexts/providers, pre-v0 imports, and `optimistic` naming.
