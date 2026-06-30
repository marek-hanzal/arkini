# 2026-06-30 v1 item detail UI rework

Reworked the selected item detail surface into `src/v1/item-detail` while keeping TileEngine untouched. `src/v0/item/ItemSheet.tsx` is now mostly a live runtime/action bridge into the v1 detail sheet.

Important decisions:

- Effect definitions now publish grants as `{ id, name }`. Runtime selectors and grant sets use `id`; player UI uses `name`. Normal detail cards must not print raw grant ids such as `grant:owned:*`.
- Generated/passive effects and active-effect product lines are grouped by explicit effect polarity: Buffs, Debuffs, Neutral effects, Mixed effects.
- Fulfilled player-facing requirements are hidden by default. Empty requirement parent boxes are hidden too.
- Product-line headers do not render output icons. Output icons belong in the Outputs section to avoid duplicated visual noise.
- Long detail sections use inner scrolling/tabs instead of turning the sheet into an endless noodle.
- Old v0 item detail cards were deleted instead of being kept around as zombie UI.

Backup note: before the UI rework, local branch `v0` was updated with a no-ff merge from `main` as a recovery branch, then work returned to `main`.
