# Item detail product line flattening

Follow-up UI density pass for `src/v0/item-detail/ui/DetailProducerLinesPanel`.

Changes made:
- Removed the nested product-line article shell background, inset shadow, and `p-3` padding. The outer `DetailCard` owns the card surface; individual lines should not pretend to be another card inside the card, because apparently UI can form geological layers if left unsupervised.
- Increased spacing between flattened product lines from `gap-2` to `gap-4` so separate lines remain readable without the old semi-dark background.
- Added a regression test that rejects the old nested line-card shell class.

Validation:
- `npm run format:check`
- `npm run game:validate -- game/arkini`
- `npm run dc`
- `npm run typecheck`
- `npm run test -- src/v0/item-detail/ui/DetailProducerLinesPanel.test.tsx`
- `npm run test`
- `npm run build`
