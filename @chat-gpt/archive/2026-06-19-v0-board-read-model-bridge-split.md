# v0 board read-model bridge split

Status: done.

## Change

Split the large board read-model bridge into focused readers without changing public runtime behavior:

- `readRuntimeBoardViewFromGameSave` keeps only board ordering + `rebuildBoardView` orchestration.
- `readRuntimeBoardItemViewFromGameSave` builds one board item view.
- `readRuntimeActivationViewFromGameSave` dispatches stash-first then producer activation, preserving old behavior.
- `readRuntimeStashActivationViewFromGameSave` owns stash activation view mapping.
- `readRuntimeProducerActivationViewFromGameSave` owns producer/product-line view mapping.
- `readRuntimeCraftViewFromGameSave` owns craft progress view mapping.
- `readRuntimeActivationRequirementViewsFromGameSave` owns passive/stored requirement view and missing requirement derivation.
- `readRuntimeActivationInputView` owns activation input DTO mapping.

## Guardrails

- No gameplay rule changes.
- No schema/config changes.
- Existing import path for `readRuntimeBoardItemViewFromGameSave` remains supported through a re-export from `readRuntimeBoardViewFromGameSave`.
- Stash activation still wins over producer activation if a broken config ever has both, matching the previous branch order.

## Validation

- `npm test -- src/v0/play/game-engine-bridge/readRuntimeBoardViewFromGameSave.test.ts`
- `npm run check`
- `npm run game:validate -- game/arkini.game.json game/arkini.assets.json`
- `npm run build`
