# Item detail input highlight + craft button progress

- Updated item detail craft UI so craft status is provided by `DetailCraftControl` and rendered inside the primary action button instead of as a card-header pill.
- Removed the tiny craft progress bar from the craft result row; the primary button now uses `UiProgressButton` and displays runtime craft progress/fill state, matching the producer action-button pattern.
- Added subtle input-row highlights for both craft inputs and producer product-line inputs:
  - fuchsia tint when more of that input is available/fillable;
  - emerald tint when the input requirement is fulfilled.
- Producer input readiness uses `readActivationInputViewReady`, so `upTo` activation semantics stay owned by the activation subsystem instead of being re-derived in the UI. Tiny mercy for future us, who apparently enjoys not stepping on rakes.
- Added control tests that lock craft status/progress packaging for the action button.

Validation:

- `npm run format:check && npm run game:validate -- game/arkini && npm run dc && npm run typecheck`
- `npm run test` (81 files, 471 tests)
- `npm run build`
- `npm run check` was attempted, but the execution wrapper times out before the combined command reaches the end; the same checks completed successfully when split.
