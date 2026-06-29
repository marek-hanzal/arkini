# Effect sensitive review

Follow-up deep review after the effect/grant migration, focused on runtime correctness rather than cosmetic cleanup.

## Fixed findings

- Capped local effect stacking now selects the closest eligible board sources for `stacking.maxSources`, while preserving the existing farthest-to-nearest application order used for override semantics. This prevents farther local hindrances/benefits from occupying a capped category before nearer sources.
- Remove-on-depleted producer/stash delivery now keeps the depleted source item in the save while planning final output placement, but treats its board cell as logically freed. This keeps the source passive effects/grants available for its own final delivery without blocking use of its source cell. After successful delivery the source is either replaced by output placed on its cell or removed normally.

## Regression coverage

- Added a product-line effect test for capped local stacking choosing the closest source.
- Added a producer completion test for a remove-on-depleted source whose passive grant is required by its final output.

## Verification

- `npm run format:check` passed with only the existing large `game/arkini.assets.json` warning.
- `npm run game:validate -- game/arkini` passed with existing unused packaged resource warnings.
- `npm run dc` passed.
- `npm run typecheck` passed.
- Full Vitest suite passed with 76 files / 551 tests using the dot reporter.
- `npm run build` passed with the existing chunk-size warning.
