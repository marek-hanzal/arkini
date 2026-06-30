# 2026-06-23 stash drop preview

## Scope
Add visible stash loot preview into item detail status UI.

## Main changes
- Added `ActivationDropView` to the board activation view model.
- Runtime stash activation view now resolves the configured loot table into UI-friendly drop rows.
- Stash status card renders drops with item icons, quantity labels, and probability labels.
- Guaranteed and chance outputs show direct probability.
- Weighted outputs show probability per roll plus configured roll count/range.
- Added regression coverage in `readRuntimeBoardViewFromGameSave.test.ts`.
