# Item detail product-line separators

Follow-up UI pass after flattening product-line cards.

Changes made:
- Product lines now render as flat sections separated by a single subtle `border-b` divider between sibling lines.
- Spacing is owned by the parent flex `gap`, not by reintroducing inner cards, padding-heavy wrappers, or fake nested surfaces.
- Added a regression test that checks separators render only between lines, not after every line like a tiny UI fence made by someone with a border addiction.

Validation:
- `npm run format:check`
- `npm run game:validate -- game/arkini`
- `npm run dc`
- `npm run typecheck`
- `npm run test -- src/v0/item-detail/ui/DetailProducerLinesPanel.test.tsx`
- `npm run test`
- `npm run build`
