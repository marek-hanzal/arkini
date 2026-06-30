# Item detail density + action affordance pass

Follow-up after the first `src/v1/item-detail` rework.

Changes made:
- Product-line blocked/missing-input action copy now says `Missing items`; the old `Feed items by drag` wording was wrong because auto-fill can pull from board/inventory and disabled lines are not a drag target.
- Main product/effect line action buttons keep primary styling even when disabled; disabled state is opacity/cursor only so unavailable primary actions remain easy to locate.
- Default line controls use short `Default` / `Un-default` copy. Product/effect default slots remain separate in runtime, but the compact UI label avoids button wrapping.
- Detail cards, nested output/input/drop/effect rows, and notes were tightened by removing low-contrast nested borders and using filled sections instead.
- Generic badges and effect polarity badges now use stronger visible backgrounds/borders so pills do not disappear into the purple soup.
- Added a regression test that catches the old missing-input/default-copy regression.

Keep TileEngine untouched for this pass.
