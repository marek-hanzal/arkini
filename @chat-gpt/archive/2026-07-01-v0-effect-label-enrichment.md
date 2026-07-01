# 2026-07-01 — Effect label enrichment without UI parsing

## Scope
- Replaced the temporary UI-side effect label parser with structured runtime label enrichment.
- Nearby effect labels are now built in the effect evaluator from the item selector and `config.items[itemId].name`.
- UI detail panels now render effect labels as already-final display text and do not rewrite ids hidden inside strings.
- Removed the `readDetailEffectRequirementLabel` parser helper and its tests.
- Removed id-to-title string mangling fallbacks from effect/item display helpers; missing catalog entries now remain explicit ids.

## Decision
- `id` is not display copy. Runtime/view-model layers must provide display-ready names where they have config/catalog context. UI must not parse arbitrary text looking for ids.

## Verification
- `npm run format:check`
- `npm run game:validate -- game/arkini`
- `npm run dc`
- `npm run typecheck`
- `npm test -- --run --reporter=dot`
- `npm run build`
