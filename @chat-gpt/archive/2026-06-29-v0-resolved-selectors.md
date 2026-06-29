# v0 resolved effect selectors

Implemented the selector pass after the pollution/effect split work.

- Removed the old flat effect target shape (`productIds`, `producerIds`, `itemIds`, `productTagsAny`, etc.). There is no legacy compatibility path.
- Effect operations now target domains explicitly:
  - product-line operations use `target.productLines` and/or `target.producers`
  - `item.blockCreate` uses `target.items`
- Source selectors may use `ids`, `anyTags`, `allTags`, `noneTags`, or `all: true`.
- Package normalization resolves tag selectors into canonical runtime selectors with concrete `ids`, while preserving the domain selector shape. Runtime evaluates only `all`/`ids` predicates and no longer reads tags to decide whether an effect applies.
- Pollution slowdown content now uses product-line tags (`pollution-sensitive:radius-2` / `pollution-sensitive:radius-3`) and two local passive effects instead of eight manually enumerated pollution slowdown effects.
- Updated schema validation, audit usage collection, runtime effect matchers, UI effect summaries, default compiled config, and affected tests.

Verification at handoff:

- `npm run format:check` passed with the existing large `game/arkini.assets.json` size warning.
- `npm run game:validate -- game/arkini` passed.
- `npm run dc` passed.
- `npm run typecheck` passed.
- `npm run test` passed: 76 files, 535 tests.
- Full `npm run check` reached the test phase and then the tool call timed out; the same components were run individually afterward/passed.
