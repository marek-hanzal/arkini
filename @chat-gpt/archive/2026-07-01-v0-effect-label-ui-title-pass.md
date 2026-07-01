# 2026-07-01 — Effect label UI title pass

## Scope
- Fixed item/producer id tokens leaking into item detail UI effect text.
- Applied title formatting to product-line note lists, active bonus summaries, and craft effect block reasons.
- Hardened the token parser so punctuation after an id (for example `item:tree:`) is not swallowed into the lookup key.

## Notes
- `item:tree` already has a proper `Tree` item name, so no config title supplementation was needed for this issue.
- UI formatting still falls back to a humanized id if an unknown item/producer id appears.

## Verification
- `npm run format:check`
- `npm run game:validate -- game/arkini`
- `npm run dc`
- `npm run typecheck`
- `npm test -- --run --reporter=dot`
- `npm run build`
