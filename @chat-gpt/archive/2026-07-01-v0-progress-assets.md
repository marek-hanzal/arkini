# 2026-07-01 — Progress-mapped item asset arrays

## Scope
- Replaced compiled item `assetId` with ordered `assetIds` arrays. No compatibility path for the old single-field shape.
- Source items still omit boring conventional assets; the compiler derives `assetIds: ["asset:<itemId>"]`.
- Runtime item catalog now exposes ordered resolved asset views instead of a single `assetSrc`.
- Board/detail item rendering picks the current asset by craft input progress, split evenly across the ordered asset list.

## Current content state
- All Arkini source/compiled items currently have exactly one asset id.
- The one explicit Shrine asset override was migrated from `assetId` to `assetIds`.

## Verification
- `npm run format:check`
- `npm run game:validate -- game/arkini`
- `npm run dc`
- `npm run typecheck`
- `npm test -- --run --reporter=dot`
- `npm run build`
