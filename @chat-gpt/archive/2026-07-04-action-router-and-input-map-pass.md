# 2026-07-04 - Action router and input-map deep pass

## Commit

`Flatten action router and input maps`

## What changed

- Flattened `src/engine/applyGameActionFx.ts` from a nested category router with a local `Context.Tag` scope into one explicit exhaustive dispatch route.
- Removed fake action-category type aliases and per-category dispatch helpers. They only forwarded the same `{ config, save, nowMs }` context and made action flow harder to follow.
- Added shared `src/event/GameEventOfType.ts` and removed duplicate local `GameEventOfType` aliases from audio and visual event planning.
- Added `src/activation/writeStoredActivationInputQuantityFx.ts` for stored activation input quantity map mutations.
- Reused that stored-input primitive from producer/craft store and withdraw paths so they do not each hand-roll `items[itemId]` writes/deletes.

## Rationale

The old action router was not buying us domain layering; it was just a second routing tree over the real action union. The direct exhaustive match keeps the one action-to-Fx edge in one place and removes a local service layer that existed only to avoid passing three props.

Stored producer/craft input maps are different owners but the same low-level mutation pattern. Keeping the primitive shared makes future stored-input behavior changes less likely to fork across producer and craft routes.

## Validation

- `npm run typecheck`
- `npm run audit:current`
- `npm run audit:dead`
- `npm run audit:dupes`
- Targeted Vitest for producer/craft/inventory/audio/visual action-adjacent paths passed.
